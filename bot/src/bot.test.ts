import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { UserFromGetMe } from "grammy/types";
import { ApiError, type Category, type LedgerClient, type NewTx, type Suggestion, type Summary, type SummaryRange, type Tx } from "./api.js";
import { createBot, dateInZone } from "./bot.js";

const CATS: Category[] = [
  { id: "c-super", name: "Supermercado", type: "expense", icon: "x", color: "#fff" },
  { id: "c-ocio", name: "Ocio", type: "expense", icon: "x", color: "#fff" },
  { id: "c-nomina", name: "Nómina", type: "income", icon: "x", color: "#fff" },
];

class FakeApi implements LedgerClient {
  created: NewTx[] = [];
  txs: Tx[] = [];
  attached: { id: string; size: number; filename: string; contentType: string }[] = [];
  deleted: string[] = [];
  failNextCreate = false;
  summaryCalls: SummaryRange[] = [];
  /** "expense:café" -> id de categoria */
  suggestions = new Map<string, string>();
  failSuggest = false;
  async categories() {
    return CATS;
  }
  async createTransaction(input: NewTx): Promise<Tx> {
    if (this.failNextCreate) {
      this.failNextCreate = false;
      throw new ApiError(500, "boom");
    }
    this.created.push(input);
    const tx: Tx = { id: `t${this.created.length}`, receiptUrl: null, date: input.date ?? "2026-11-06", ...input };
    this.txs.push(tx);
    return tx;
  }
  async lastTransaction() {
    return this.txs.at(-1) ?? null;
  }
  async attachReceipt(id: string, bytes: ArrayBuffer, filename: string, contentType: string) {
    this.attached.push({ id, size: bytes.byteLength, filename, contentType });
    return this.txs.find((t) => t.id === id)!;
  }
  async deleteTransaction(id: string) {
    this.deleted.push(id);
    return true;
  }
  async summary(range?: SummaryRange): Promise<Summary> {
    this.summaryCalls.push(range);
    const period = !range ? "2026-11" : "month" in range ? range.month : `${range.from}/${range.to}`;
    return { period, income: 1200, expense: 300.5, balance: 899.5, expenseByCategory: [{ category: "Ocio", total: 300.5 }] };
  }
  async suggestCategory(note: string, type: "expense" | "income"): Promise<Suggestion | null> {
    if (this.failSuggest) throw new ApiError(500, "boom");
    const id = this.suggestions.get(`${type}:${note.toLowerCase()}`);
    return id ? { categoryId: id, count: 3 } : null;
  }
}

type Call = { method: string; payload: Record<string, any> };

function setup(allowedId = 42) {
  const api = new FakeApi();
  const calls: Call[] = [];
  const bot = createBot({
    token: "123:SECRET",
    allowedId,
    api,
    timeZone: "Europe/Madrid",
    download: async () => new Uint8Array([1, 2, 3]).buffer,
    botInfo: { id: 1, is_bot: true, first_name: "t", username: "t_bot" } as unknown as UserFromGetMe,
  });
  bot.api.config.use(async (_prev, method, payload) => {
    calls.push({ method, payload: payload as Record<string, any> });
    const result = method === "sendMessage" ? { message_id: 1, date: 0, chat: { id: 42, type: "private" }, text: "x" } : true;
    return { ok: true, result } as any;
  });
  let n = 1;
  const user = (id: number) => ({ id, is_bot: false, first_name: "B" });
  // En produccion (bot.start) los errores de handleUpdate van a bot.catch; aqui lo emulamos.
  const send = (update: any) =>
    bot.handleUpdate({ update_id: n++, ...update }).catch((err) => bot.errorHandler(err));
  return {
    api,
    calls,
    text: (t: string, from = 42) =>
      send({
        message: {
          message_id: n,
          date: 0,
          chat: { id: from, type: "private" },
          from: user(from),
          text: t,
          ...(t.startsWith("/") ? { entities: [{ type: "bot_command", offset: 0, length: t.split(" ")[0]!.length }] } : {}),
        },
      }),
    photo: (from = 42) =>
      send({
        message: {
          message_id: n,
          date: 0,
          chat: { id: from, type: "private" },
          from: user(from),
          photo: [
            { file_id: "small", file_unique_id: "a", width: 90, height: 90 },
            { file_id: "big", file_unique_id: "b", width: 1280, height: 960 },
          ],
        },
      }),
    press: (data: string, from = 42) =>
      send({
        callback_query: {
          id: String(n),
          from: user(from),
          chat_instance: "x",
          data,
          message: { message_id: 7, date: 0, chat: { id: from, type: "private" }, text: "x" },
        },
      }),
    last: (method: string) => calls.filter((c) => c.method === method).at(-1),
    buttons: (call?: Call): string[] =>
      (call?.payload.reply_markup?.inline_keyboard ?? []).flat().map((b: { callback_data: string }) => b.callback_data),
  };
}

describe("flujo de gasto", () => {
  let h: ReturnType<typeof setup>;
  beforeEach(() => {
    h = setup();
  });

  it("ofrece las categorias de gasto como botones y guarda al pulsar", async () => {
    await h.text("12,50 café");
    const ask = h.last("sendMessage");
    assert.match(ask!.payload.text, /Gasto: 12,50\s€ · café/);
    const data = h.buttons(ask);
    assert.equal(data.length, 3); // 2 categorias de gasto + cancelar
    assert.match(data[0]!, /^c:[0-9a-f]{8}:0$/);
    assert.ok(data[2]!.startsWith("x:"));

    await h.press(data[1]!); // Ocio
    assert.deepEqual(h.api.created, [{ type: "expense", amount: 12.5, categoryId: "c-ocio", note: "café" }]);
    const done = h.last("editMessageText");
    assert.match(done!.payload.text, /✅ Guardado/);
    assert.match(done!.payload.text, /Ocio/);
    assert.deepEqual(h.buttons(done), ["u:t1"]);
  });

  it("los ingresos solo ofrecen categorias de ingreso", async () => {
    await h.text("+1200 nómina");
    const ask = h.last("sendMessage");
    assert.match(ask!.payload.text, /Ingreso: 1200,00\s€/);
    assert.equal(h.buttons(ask).length, 2); // Nomina + cancelar
    await h.press(h.buttons(ask)[0]!);
    assert.equal(h.api.created[0]?.type, "income");
    assert.equal(h.api.created[0]?.categoryId, "c-nomina");
  });

  it("'ayer' envia la fecha calculada", async () => {
    await h.text("45€ gasolina ayer");
    await h.press(h.buttons(h.last("sendMessage"))[0]!);
    assert.equal(h.api.created[0]?.date, dateInZone(1, "Europe/Madrid"));
  });

  it("un doble toque no crea dos movimientos", async () => {
    await h.text("3 pan");
    const data = h.buttons(h.last("sendMessage"))[0]!;
    await h.press(data);
    await h.press(data);
    assert.equal(h.api.created.length, 1);
    assert.equal(h.last("answerCallbackQuery")!.payload.show_alert, true);
  });

  it("si la API falla avisa y permite reintentar", async () => {
    await h.text("3 pan");
    const data = h.buttons(h.last("sendMessage"))[0]!;
    h.api.failNextCreate = true;
    await h.press(data);
    assert.match(h.last("sendMessage")!.payload.text, /⚠️.*500 boom/);
    assert.equal(h.api.created.length, 0);
    await h.press(data);
    assert.equal(h.api.created.length, 1);
  });

  it("cancelar no guarda nada", async () => {
    await h.text("3 pan");
    const cancel = h.buttons(h.last("sendMessage")).find((d) => d.startsWith("x:"))!;
    await h.press(cancel);
    assert.equal(h.api.created.length, 0);
    assert.match(h.last("editMessageText")!.payload.text, /Cancelado/);
  });

  it("deshacer borra el movimiento", async () => {
    await h.text("3 pan");
    await h.press(h.buttons(h.last("sendMessage"))[0]!);
    await h.press("u:t1");
    assert.deepEqual(h.api.deleted, ["t1"]);
  });

  it("un texto sin importe responde con la ayuda", async () => {
    await h.text("hola qué tal");
    assert.match(h.last("sendMessage")!.payload.text, /No he encontrado un importe/);
    assert.equal(h.api.created.length, 0);
  });
});

describe("sugerencia de categoria", () => {
  it("propone primero (con estrella) la categoria que ya usaste con esa nota", async () => {
    const h = setup();
    h.api.suggestions.set("expense:café", "c-ocio");
    await h.text("12,50 café");
    const ask = h.last("sendMessage");
    assert.match(ask!.payload.text, /💡 Sueles ponerlo en Ocio/);
    const rows = ask!.payload.reply_markup.inline_keyboard as { text: string; callback_data: string }[][];
    assert.equal(rows[0]![0]!.text, "⭐ Ocio");
    assert.equal(rows.length, 3); // sugerida, resto, cancelar
    await h.press(rows[0]![0]!.callback_data);
    assert.equal(h.api.created[0]?.categoryId, "c-ocio");
  });

  it("sin historial no cambia el orden ni muestra la pista", async () => {
    const h = setup();
    await h.text("12,50 café");
    const ask = h.last("sendMessage");
    assert.doesNotMatch(ask!.payload.text, /💡/);
    const first = ask!.payload.reply_markup.inline_keyboard[0][0].text;
    assert.equal(first, "Supermercado");
  });

  it("si la sugerencia falla, el flujo normal sigue funcionando", async () => {
    const h = setup();
    h.api.failSuggest = true;
    await h.text("12,50 café");
    assert.equal(h.buttons(h.last("sendMessage")).length, 3);
  });

  it("ignora sugerencias de categorias que no son de ese tipo", async () => {
    const h = setup();
    h.api.suggestions.set("expense:café", "c-nomina"); // categoria de ingreso
    await h.text("12,50 café");
    assert.doesNotMatch(h.last("sendMessage")!.payload.text, /💡/);
  });
});

describe("fotos como ticket", () => {
  it("pide confirmacion y adjunta la imagen mas grande al ultimo movimiento", async () => {
    const h = setup();
    await h.text("12,50 café");
    await h.press(h.buttons(h.last("sendMessage"))[0]!);
    await h.photo();
    const ask = h.last("sendMessage");
    assert.match(ask!.payload.text, /ticket de/);
    const [yes] = h.buttons(ask);
    assert.match(yes!, /^p:[0-9a-f]{8}$/);
    await h.press(yes!);
    assert.deepEqual(h.api.attached, [{ id: "t1", size: 3, filename: "ticket.jpg", contentType: "image/jpeg" }]);
    assert.match(h.last("editMessageText")!.payload.text, /Ticket guardado/);
  });

  it("sin movimientos previos no adjunta nada", async () => {
    const h = setup();
    await h.photo();
    assert.match(h.last("sendMessage")!.payload.text, /No hay ningún movimiento/);
  });
});

describe("comandos y seguridad", () => {
  it("/resumen muestra el balance", async () => {
    const h = setup();
    await h.text("/resumen");
    const text = h.last("sendMessage")!.payload.text as string;
    assert.match(text, /Balance: 899,50\s€/);
    assert.match(text, /Ocio: 300,50\s€/);
  });

  it("/resumen AAAA pide el rango del año completo", async () => {
    const h = setup();
    await h.text("/resumen 2026");
    assert.deepEqual(h.api.summaryCalls.at(-1), { from: "2026-01-01", to: "2026-12-31" });
    assert.match(h.last("sendMessage")!.payload.text, /Año 2026/);
  });

  it("/resumen AAAA-MM pide ese mes", async () => {
    const h = setup();
    await h.text("/resumen 2026-10");
    assert.deepEqual(h.api.summaryCalls.at(-1), { month: "2026-10" });
  });

  it("/resumen rechaza meses mal escritos", async () => {
    const h = setup();
    await h.text("/resumen octubre");
    assert.match(h.last("sendMessage")!.payload.text, /Uso:/);
  });

  it("ignora por completo a cualquier otro usuario", async () => {
    const h = setup(42);
    await h.text("12,50 café", 99);
    await h.text("/resumen", 99);
    await h.photo(99);
    await h.press("u:t1", 99);
    assert.equal(h.calls.length, 0);
    assert.equal(h.api.created.length, 0);
    assert.equal(h.api.deleted.length, 0);
  });
});
