import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { ApiError, LedgerApi } from "./api.js";

async function withServer(
  handler: (req: IncomingMessage, body: Buffer) => { status: number; json?: unknown },
  run: (api: LedgerApi, seen: { url: string; method: string; key?: string; type?: string; body: Buffer }[]) => Promise<void>,
) {
  const seen: { url: string; method: string; key?: string; type?: string; body: Buffer }[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      seen.push({
        url: req.url ?? "",
        method: req.method ?? "",
        key: req.headers["x-bot-key"] as string | undefined,
        type: req.headers["content-type"],
        body,
      });
      const out = handler(req, body);
      res.writeHead(out.status, { "Content-Type": "application/json" });
      res.end(out.json === undefined ? "" : JSON.stringify(out.json));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  try {
    await run(new LedgerApi(`http://127.0.0.1:${port}`, "k".repeat(40)), seen);
  } finally {
    server.close();
  }
}

test("envia la clave y crea transacciones", async () => {
  await withServer(
    () => ({ status: 201, json: { id: "t1", type: "expense", amount: 12.5, categoryId: "c1", date: "2026-11-06", note: "x", receiptUrl: null } }),
    async (api, seen) => {
      const tx = await api.createTransaction({ type: "expense", amount: 12.5, categoryId: "c1", note: "x" });
      assert.equal(tx.id, "t1");
      assert.equal(seen[0]?.url, "/api/bot/transactions");
      assert.equal(seen[0]?.key, "k".repeat(40));
      assert.equal(seen[0]?.type, "application/json");
      assert.deepEqual(JSON.parse(seen[0]?.body.toString() ?? ""), { type: "expense", amount: 12.5, categoryId: "c1", note: "x" });
    },
  );
});

test("lastTransaction devuelve null con 404 y errores con ApiError", async () => {
  await withServer(
    (req) => (req.url?.endsWith("/last") ? { status: 404 } : { status: 400, json: { message: "Categoria no valida" } }),
    async (api) => {
      assert.equal(await api.lastTransaction(), null);
      await assert.rejects(
        () => api.createTransaction({ type: "expense", amount: 1, categoryId: "x", note: "" }),
        (e: unknown) => e instanceof ApiError && e.status === 400 && e.message === "Categoria no valida",
      );
    },
  );
});

test("attachReceipt envia multipart con el fichero", async () => {
  await withServer(
    () => ({ status: 200, json: { id: "t1", type: "expense", amount: 1, categoryId: "c", date: "2026-11-06", note: "", receiptUrl: "/api/receipts/u/f.jpg?exp=1&sig=2" } }),
    async (api, seen) => {
      const bytes = new Uint8Array([1, 2, 3, 4]).buffer;
      const tx = await api.attachReceipt("t 1", bytes, "ticket.jpg", "image/jpeg");
      assert.ok(tx.receiptUrl);
      assert.equal(seen[0]?.url, "/api/bot/transactions/t%201/receipt");
      assert.match(seen[0]?.type ?? "", /^multipart\/form-data; boundary=/);
      const body = seen[0]?.body.toString("latin1") ?? "";
      assert.match(body, /name="file"; filename="ticket.jpg"/);
      assert.match(body, /Content-Type: image\/jpeg/);
    },
  );
});

test("deleteTransaction: true si existe, false si 404", async () => {
  let status = 204;
  await withServer(
    () => ({ status }),
    async (api, seen) => {
      assert.equal(await api.deleteTransaction("a"), true);
      status = 404;
      assert.equal(await api.deleteTransaction("a"), false);
      assert.equal(seen[0]?.method, "DELETE");
    },
  );
});

test("summary construye la query segun el periodo", async () => {
  await withServer(
    () => ({ status: 200, json: { period: "x", income: 0, expense: 0, balance: 0, expenseByCategory: [] } }),
    async (api, seen) => {
      await api.summary();
      await api.summary({ month: "2026-10" });
      await api.summary({ from: "2026-01-01", to: "2026-12-31" });
      assert.deepEqual(
        seen.map((s) => s.url),
        ["/api/bot/summary", "/api/bot/summary?month=2026-10", "/api/bot/summary?from=2026-01-01&to=2026-12-31"],
      );
    },
  );
});

test("suggestCategory codifica la nota y devuelve null con 404", async () => {
  let status = 200;
  await withServer(
    () => (status === 200 ? { status, json: { categoryId: "c1", count: 4 } } : { status }),
    async (api, seen) => {
      assert.deepEqual(await api.suggestCategory("café", "expense"), { categoryId: "c1", count: 4 });
      assert.equal(seen[0]?.url, "/api/bot/suggest?note=caf%C3%A9&type=expense");
      status = 404;
      assert.equal(await api.suggestCategory("raro", "expense"), null);
    },
  );
});
