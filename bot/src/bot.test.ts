import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { UserFromGetMe } from "grammy/types";
import { ApiError, type NewRecurring, type Recurring, type NewWarranty, type TxEdit, type Warranty, type Category, type ExportScope, type MonthTotal, type CategoryInput, type CategoryUsage, type LedgerClient, type NewTx, type Suggestion, type Summary, type SummaryRange, type Tx } from "./api.js";
import { COMMANDS, createBot, dateInZone } from "./bot.js";
import { pickColor } from "./categories.js";

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
  cats: Category[] = CATS.map((c) => ({ ...c }));
  usage: Record<string, [number, number]> = { "c-ocio": [5, 1] };
  catCalls: string[] = [];
  async categories() {
    return this.cats;
  }
  rlist: Recurring[] = [];
  rCreated: NewRecurring[] = [];
  rUpdated: { id: string; edit: { active?: boolean; amount?: number } }[] = [];
  rDeleted: string[] = [];
  prevSummary: Summary | null = null;
  async recurring() {
    return this.rlist;
  }
  async createRecurring(input: NewRecurring): Promise<Recurring> {
    this.rCreated.push(input);
    const r: Recurring = { id: `r${this.rCreated.length}`, active: true, note: "", nextDate: input.nextDate ?? "2026-11-06", ...input };
    this.rlist.push(r);
    return r;
  }
  async updateRecurring(id: string, edit: { active?: boolean; amount?: number }): Promise<Recurring> {
    this.rUpdated.push({ id, edit });
    const r = this.rlist.find((x) => x.id === id)!;
    Object.assign(r, edit);
    return r;
  }
  async deleteRecurring(id: string) {
    this.rDeleted.push(id);
    return true;
  }
  async syncRecurring() {
    return 0;
  }
  async lastManualEntryAt() {
    return null;
  }
  editCalls: { id: string; edit: TxEdit }[] = [];
  wlist: Warranty[] = [];
  wCreated: NewWarranty[] = [];
  wAttached: { id: string; size: number }[] = [];
  wDeleted: string[] = [];
  async searchTransactions(q: string) {
    const n = q.toLowerCase();
    return this.txs.filter((t) => t.note.toLowerCase().includes(n) || String(t.amount) === q);
  }
  async editTransaction(id: string, edit: TxEdit): Promise<Tx> {
    this.editCalls.push({ id, edit });
    const t = this.txs.find((x) => x.id === id)!;
    Object.assign(t, edit);
    return t;
  }
  async warranties() {
    return this.wlist;
  }
  async createWarranty(input: NewWarranty): Promise<Warranty> {
    this.wCreated.push(input);
    const w: Warranty = {
      id: `w${this.wCreated.length}`,
      name: input.name,
      purchaseDate: input.purchaseDate ?? "2026-11-06",
      months: input.months,
      expiresOn: "2028-11-06",
      daysLeft: 730,
      note: "",
      receiptUrl: null,
    };
    this.wlist.push(w);
    return w;
  }
  async attachWarrantyReceipt(id: string, bytes: ArrayBuffer) {
    this.wAttached.push({ id, size: bytes.byteLength });
    return this.wlist.find((w) => w.id === id)!;
  }
  async deleteWarranty(id: string) {
    this.wDeleted.push(id);
    return true;
  }
  async downloadReceipt(_url: string) {
    return new Uint8Array([9, 9]).buffer as ArrayBuffer;
  }
  monthlyData: MonthTotal[] = [
    { month: "2026-10", income: 2000, expense: 800 },
    { month: "2026-11", income: 0, expense: 300 },
  ];
  exportCalls: ExportScope[] = [];
  async monthly(_months: number) {
    return this.monthlyData;
  }
  async exportCsv(scope?: ExportScope) {
    this.exportCalls.push(scope);
    return new TextEncoder().encode("fecha;tipo\n").buffer as ArrayBuffer;
  }
  async categoryUsage(): Promise<CategoryUsage[]> {
    return this.cats.map((c) => ({ ...c, transactions: this.usage[c.id]?.[0] ?? 0, recurring: this.usage[c.id]?.[1] ?? 0 }));
  }
  async createCategory(input: Required<CategoryInput>): Promise<Category> {
    this.catCalls.push(`create ${JSON.stringify(input)}`);
    const c: Category = { id: `n${this.cats.length}`, ...input };
    this.cats.push(c);
    return c;
  }
  async updateCategory(id: string, input: CategoryInput): Promise<Category> {
    this.catCalls.push(`update ${id} ${JSON.stringify(input)}`);
    if (input.name && this.cats.some((c) => c.id !== id && c.name === input.name)) throw new ApiError(409, "dup");
    const c = this.cats.find((x) => x.id === id)!;
    Object.assign(c, input);
    return c;
  }
  async deleteCategory(id: string, moveTo?: string): Promise<number> {
    this.catCalls.push(`delete ${id} ${moveTo ?? ""}`.trim());
    this.cats = this.cats.filter((c) => c.id !== id);
    return moveTo ? 6 : 0;
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
    if (this.prevSummary && range && "month" in range && range.month === "2026-10") return this.prevSummary;
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
    assert.deepEqual(h.api.summaryCalls[0], { month: "2026-10" });
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

describe("menu de comandos", () => {
  it("expone los comandos con descripcion y el /ayuda los lista", async () => {
    const h = setup();
    assert.ok(COMMANDS.every((c) => /^[a-z]{1,32}$/.test(c.command) && c.description.length >= 3 && c.description.length <= 256));
    await h.text("/ayuda");
    const text = h.last("sendMessage")!.payload.text as string;
    for (const c of COMMANDS) assert.ok(text.includes(`/${c.command}`), c.command);
  });
});

describe("gestion de categorias", () => {
  let h: ReturnType<typeof setup>;
  beforeEach(() => {
    h = setup();
  });
  const pid = (data: string) => data.split(":")[1]!;

  it("/categorias lista agrupado y con uso", async () => {
    await h.text("/categorias");
    const m = h.last("sendMessage")!;
    assert.match(m.payload.text, /Gastos:/);
    assert.match(m.payload.text, /Ocio · 5 mov\., 1 recurrente/);
    assert.match(m.payload.text, /Ingresos:/);
    const data = h.buttons(m);
    assert.ok(data.some((d) => /^kn:[0-9a-f]{8}:e$/.test(d)));
    assert.ok(data.every((d) => Buffer.byteLength(d) <= 64));
  });

  it("renombra: boton -> texto -> API", async () => {
    await h.text("/categorias");
    const open = h.buttons(h.last("sendMessage")).find((d) => d.startsWith("k:"))!; // Ocio (orden alfabetico)
    await h.press(open);
    const rename = h.buttons(h.last("editMessageText")).find((d) => d.startsWith("kr:"))!;
    await h.press(rename);
    await h.text("Diversión");
    assert.deepEqual(h.api.catCalls, ['update c-ocio {"name":"Diversión"}']);
    assert.match(h.last("sendMessage")!.payload.text, /Renombrada a «Diversión»/);
    // ya no espera texto: se interpreta como gasto normal
    await h.text("3 pan");
    assert.match(h.last("sendMessage")!.payload.text, /Elige categoría/);
  });

  it("nombre duplicado al renombrar sigue esperando", async () => {
    await h.text("/categorias");
    await h.press(h.buttons(h.last("sendMessage")).find((d) => d.startsWith("k:"))!);
    await h.press(h.buttons(h.last("editMessageText")).find((d) => d.startsWith("kr:"))!);
    await h.text("Supermercado");
    assert.match(h.last("sendMessage")!.payload.text, /Ya tienes una categoría/);
    await h.text("Cine");
    assert.match(h.last("sendMessage")!.payload.text, /Renombrada a «Cine»/);
  });

  it("crea: tipo -> nombre -> icono, con color automatico", async () => {
    await h.text("/nuevacategoria");
    await h.press(h.buttons(h.last("sendMessage"))[0]!.replace(/:e$/, ":e"));
    await h.text("Mascotas");
    const grid = h.last("sendMessage")!;
    assert.match(grid.payload.text, /icono para «Mascotas»/);
    const pick = h.buttons(grid)[19]!; // PawPrint
    await h.press(pick);
    assert.equal(h.api.catCalls.length, 1);
    const call = JSON.parse(h.api.catCalls[0]!.replace("create ", ""));
    assert.deepEqual({ ...call, color: "x" }, { name: "Mascotas", type: "expense", icon: "PawPrint", color: "x" });
    assert.match(call.color, /^#[0-9a-f]{6}$/);
    assert.match(h.last("editMessageText")!.payload.text, /«Mascotas» creada/);
  });

  it("no crea duplicados (ignora tildes y mayusculas)", async () => {
    await h.text("/nuevacategoria");
    await h.press(h.buttons(h.last("sendMessage"))[0]!);
    await h.text("supermercado");
    assert.match(h.last("sendMessage")!.payload.text, /Ya tienes una categoría/);
    assert.equal(h.api.catCalls.length, 0);
  });

  it("un comando cancela la espera de nombre", async () => {
    await h.text("/nuevacategoria");
    await h.press(h.buttons(h.last("sendMessage"))[1]!); // ingreso
    await h.text("/cancelar");
    await h.text("12 café");
    assert.match(h.last("sendMessage")!.payload.text, /Elige categoría/);
  });

  it("cambia el icono", async () => {
    await h.text("/categorias");
    await h.press(h.buttons(h.last("sendMessage")).find((d) => d.startsWith("k:"))!);
    await h.press(h.buttons(h.last("editMessageText")).find((d) => d.startsWith("ki:"))!);
    const grid = h.buttons(h.last("editMessageText"));
    assert.equal(grid.length, 24);
    await h.press(grid[16]!); // Plane
    assert.deepEqual(h.api.catCalls, ['update c-ocio {"icon":"Plane"}']);
  });

  it("elimina una categoria sin uso tras confirmar", async () => {
    await h.text("/categorias");
    const data = h.buttons(h.last("sendMessage"));
    await h.press(data.find((d) => d.startsWith("k:") && d.endsWith(":1"))!); // Supermercado
    await h.press(h.buttons(h.last("editMessageText")).find((d) => d.startsWith("kd:"))!);
    assert.match(h.last("editMessageText")!.payload.text, /¿Eliminar «Supermercado»\?/);
    await h.press(h.buttons(h.last("editMessageText")).find((d) => d.startsWith("ky:"))!);
    assert.deepEqual(h.api.catCalls, ["delete c-super"]);
  });

  it("elimina una categoria con uso moviendola a otra", async () => {
    await h.text("/categorias");
    await h.press(h.buttons(h.last("sendMessage")).find((d) => d.startsWith("k:") && d.endsWith(":0"))!); // Ocio
    await h.press(h.buttons(h.last("editMessageText")).find((d) => d.startsWith("kd:"))!);
    const ask = h.last("editMessageText")!;
    assert.match(ask.payload.text, /¿a qué categoría los paso\?/);
    const moves = h.buttons(ask).filter((d) => d.startsWith("km:"));
    assert.equal(moves.length, 1); // solo Supermercado (mismo tipo)
    await h.press(moves[0]!);
    assert.deepEqual(h.api.catCalls, ["delete c-ocio c-super"]);
    assert.match(h.last("editMessageText")!.payload.text, /6 elemento\(s\) pasados a «Supermercado»/);
  });

  it("no deja borrar si no hay otra categoria del mismo tipo", async () => {
    h.api.usage["c-nomina"] = [2, 0];
    await h.text("/categorias");
    await h.press(h.buttons(h.last("sendMessage")).find((d) => d.startsWith("k:") && d.endsWith(":2"))!);
    await h.press(h.buttons(h.last("editMessageText")).find((d) => d.startsWith("kd:"))!);
    assert.match(h.last("editMessageText")!.payload.text, /Crea otra primero/);
    assert.equal(h.api.catCalls.length, 0);
  });

  it("botones caducados avisan", async () => {
    await h.press("k:deadbeef:0");
    assert.equal(h.last("answerCallbackQuery")!.payload.show_alert, true);
  });

  it("pickColor elige el menos usado", () => {
    assert.equal(pickColor([]), "#f97316");
    assert.equal(pickColor([{ color: "#f97316" }, { color: "#f97316" }, { color: "#eab308" }]), "#84cc16");
  });
});

describe("graficos y exportacion", () => {
  let h: ReturnType<typeof setup>;
  beforeEach(() => {
    h = setup();
  });
  const PNG = [0x89, 0x50, 0x4e, 0x47];

  it("/grafico envia un PNG real con el resumen como pie", async () => {
    await h.text("/grafico");
    const c = h.last("sendPhoto")!;
    assert.match(c.payload.caption, /Gastos: 300,50\s€/);
    assert.ok(c.payload.photo);
  });

  it("/grafico con año y argumento invalido", async () => {
    await h.text("/grafico 2026");
    assert.deepEqual(h.api.summaryCalls.at(-1), { from: "2026-01-01", to: "2026-12-31" });
    await h.text("/grafico mañana");
    assert.match(h.last("sendMessage")!.payload.text, /Uso: \/grafico/);
  });

  it("/grafico sin gastos avisa en vez de enviar imagen vacia", async () => {
    h.api.summary = async () => ({ period: "2026-11", income: 0, expense: 0, balance: 0, expenseByCategory: [] });
    await h.text("/grafico");
    assert.equal(h.last("sendPhoto"), undefined);
    assert.match(h.last("sendMessage")!.payload.text, /No hay gastos/);
  });

  it("/balance envia imagen y valida los meses", async () => {
    await h.text("/balance 6");
    assert.ok(h.last("sendPhoto"));
    await h.text("/balance 99");
    assert.match(h.last("sendMessage")!.payload.text, /Uso: \/balance/);
  });

  it("/balance sin datos avisa", async () => {
    h.api.monthlyData = [{ month: "2026-11", income: 0, expense: 0 }];
    await h.text("/balance");
    assert.match(h.last("sendMessage")!.payload.text, /Todavía no hay movimientos/);
  });

  it("/exportar manda el CSV como documento", async () => {
    await h.text("/exportar 2026-10");
    assert.deepEqual(h.api.exportCalls, [{ month: "2026-10" }]);
    assert.ok(h.last("sendDocument"));
    await h.text("/exportar");
    assert.deepEqual(h.api.exportCalls.at(-1), undefined);
  });
});

const W = (over: Partial<Warranty> = {}): Warranty => ({
  id: "w0",
  name: "TV Samsung",
  purchaseDate: "2025-11-06",
  months: 24,
  expiresOn: "2027-11-06",
  daysLeft: 365,
  note: "",
  receiptUrl: null,
  ...over,
});

describe("garantias", () => {
  let h: ReturnType<typeof setup>;
  beforeEach(() => {
    h = setup();
  });

  it("/garantias sin datos invita a crear", async () => {
    await h.text("/garantias");
    assert.match(h.last("sendMessage")!.payload.text, /No tienes garantías/);
  });

  it("lista con estado y detalle", async () => {
    h.api.wlist = [W({ id: "w1", name: "Móvil", daysLeft: -3, expiresOn: "2026-11-03" }), W({ id: "w2", daysLeft: 20 }), W({ id: "w3", name: "Nevera", daysLeft: 400, receiptUrl: "/api/receipts/u/x.jpg?exp=1&sig=a" })];
    await h.text("/garantias");
    const m = h.last("sendMessage")!;
    assert.match(m.payload.text, /❌ Móvil · caducó hace 3 días/);
    assert.match(m.payload.text, /⚠️ TV Samsung · caduca en 20 días/);
    assert.match(m.payload.text, /✅ Nevera .* 📎/);
    await h.press(h.buttons(m)[2]!); // Nevera
    const d = h.last("editMessageText")!;
    assert.match(d.payload.text, /Comprado el 06\/11\/2025 · garantía de 2 años/);
    assert.ok(h.buttons(d).some((b) => b.startsWith("wv:")));
    await h.press(h.buttons(d).find((b) => b.startsWith("wv:"))!);
    assert.ok(h.last("sendPhoto"));
  });

  it("crear: nombre, fecha con botones y duracion", async () => {
    await h.text("/nuevagarantia");
    await h.text("Lavadora");
    const ask = h.buttons(h.last("sendMessage"));
    await h.press(ask[1]!); // ayer
    assert.match(h.last("editMessageText")!.payload.text, /¿Cuánto dura la garantía\?/);
    const durations = h.buttons(h.last("editMessageText"));
    await h.press(durations[1]!); // 2 años
    assert.deepEqual(h.api.wCreated, [{ name: "Lavadora", purchaseDate: dateInZone(1, "Europe/Madrid"), months: 24 }]);
    assert.match(h.last("sendMessage")!.payload.text, /Garantía guardada/);
  });

  it("crear con fecha escrita y meses a medida, validando", async () => {
    await h.text("/nuevagarantia");
    await h.text("Cámara");
    await h.press(h.buttons(h.last("sendMessage"))[2]!); // otra fecha
    await h.text("mañana");
    assert.match(h.last("sendMessage")!.payload.text, /No entiendo esa fecha/);
    await h.text("15/03/2025");
    const kb = h.buttons(h.last("sendMessage"));
    await h.press(kb.find((b) => b.endsWith(":o"))!);
    await h.text("999");
    assert.match(h.last("sendMessage")!.payload.text, /entre 1 y 120/);
    await h.text("18");
    assert.deepEqual(h.api.wCreated, [{ name: "Cámara", purchaseDate: "2025-03-15", months: 18 }]);
  });

  it("la foto tras crear va a la garantia; despues vuelve a los movimientos", async () => {
    await h.text("/nuevagarantia");
    await h.text("Horno");
    await h.press(h.buttons(h.last("sendMessage"))[0]!);
    await h.press(h.buttons(h.last("editMessageText"))[0]!);
    await h.photo();
    const ask = h.last("sendMessage")!;
    assert.match(ask.payload.text, /ticket de la garantía «Horno»/);
    await h.press(h.buttons(ask)[0]!);
    assert.deepEqual(h.api.wAttached, [{ id: "w1", size: 3 }]);
    await h.photo();
    assert.match(h.last("sendMessage")!.payload.text, /No hay ningún movimiento|ticket de:/);
  });

  it("eliminar pide confirmacion", async () => {
    h.api.wlist = [W({ id: "w1" })];
    await h.text("/garantias");
    await h.press(h.buttons(h.last("sendMessage"))[0]!);
    await h.press(h.buttons(h.last("editMessageText")).find((b) => b.startsWith("wd:"))!);
    assert.equal(h.api.wDeleted.length, 0);
    await h.press(h.buttons(h.last("editMessageText")).find((b) => b.startsWith("wy:"))!);
    assert.deepEqual(h.api.wDeleted, ["w1"]);
  });
});

describe("buscar y editar movimientos", () => {
  let h: ReturnType<typeof setup>;
  beforeEach(() => {
    h = setup();
    h.api.txs.push({ id: "t9", type: "expense", amount: 12.5, categoryId: "c-ocio", date: "2026-11-03", note: "café", receiptUrl: null });
  });

  it("/buscar sin texto o sin resultados", async () => {
    await h.text("/buscar");
    assert.match(h.last("sendMessage")!.payload.text, /Uso: \/buscar/);
    await h.text("/buscar pizza");
    assert.match(h.last("sendMessage")!.payload.text, /No he encontrado nada con «pizza»/);
  });

  it("busca y abre el detalle con las acciones", async () => {
    await h.text("/buscar café");
    const list = h.last("sendMessage")!;
    assert.match(list.payload.text, /1 resultado/);
    await h.press(h.buttons(list)[0]!);
    const d = h.last("editMessageText")!;
    assert.match(d.payload.text, /Gasto: 12,50\s€ · Ocio · café · 03\/11/);
    const kinds = h.buttons(d).map((b) => b.split(":")[0]);
    assert.deepEqual(kinds, ["ma", "mc", "md", "mn", "mx", "mb"]);
  });

  it("edita el importe (y valida)", async () => {
    await h.text("/buscar café");
    await h.press(h.buttons(h.last("sendMessage"))[0]!);
    await h.press(h.buttons(h.last("editMessageText"))[0]!);
    await h.text("abc");
    assert.match(h.last("sendMessage")!.payload.text, /No entiendo ese importe/);
    await h.text("20,5");
    assert.deepEqual(h.api.editCalls, [{ id: "t9", edit: { amount: 20.5 } }]);
    assert.match(h.last("sendMessage")!.payload.text, /Actualizado[\s\S]*20,50\s€/);
  });

  it("edita fecha, nota y categoria", async () => {
    await h.text("/buscar café");
    await h.press(h.buttons(h.last("sendMessage"))[0]!);
    const kb = h.buttons(h.last("editMessageText"));
    await h.press(kb.find((b) => b.startsWith("md:"))!);
    await h.text("ayer");
    await h.press(kb.find((b) => b.startsWith("mn:"))!);
    await h.text("-");
    await h.press(kb.find((b) => b.startsWith("mc:"))!);
    const cats = h.buttons(h.last("editMessageText")).filter((b) => b.startsWith("mk:"));
    assert.equal(cats.length, 2); // solo categorias de gasto
    await h.press(cats[0]!); // Supermercado
    assert.deepEqual(h.api.editCalls.map((c) => c.edit), [
      { date: dateInZone(1, "Europe/Madrid") },
      { note: "" },
      { categoryId: "c-super" },
    ]);
  });

  it("borra con confirmacion y /ultimo ofrece editar", async () => {
    await h.text("/ultimo");
    const last = h.last("sendMessage")!;
    assert.deepEqual(h.buttons(last).map((b) => b.split(":")[0]), ["me", "u"]);
    await h.press(h.buttons(last)[0]!);
    await h.press(h.buttons(h.last("editMessageText")).find((b) => b.startsWith("mx:"))!);
    assert.equal(h.api.deleted.length, 0);
    await h.press(h.buttons(h.last("editMessageText")).find((b) => b.startsWith("my:"))!);
    assert.deepEqual(h.api.deleted, ["t9"]);
  });

  it("un comando cancela la edicion pendiente", async () => {
    await h.text("/buscar café");
    await h.press(h.buttons(h.last("sendMessage"))[0]!);
    await h.press(h.buttons(h.last("editMessageText"))[0]!);
    await h.text("/ayuda");
    await h.text("7 pan");
    assert.equal(h.api.editCalls.length, 0);
    assert.match(h.last("sendMessage")!.payload.text, /Elige categoría/);
  });
});

describe("recurrentes", () => {
  let h: ReturnType<typeof setup>;
  const R = (over: Partial<Recurring> = {}): Recurring => ({
    id: "r0",
    type: "expense",
    amount: 12.99,
    categoryId: "c-ocio",
    frequency: "monthly",
    nextDate: "2026-12-01",
    active: true,
    note: "Netflix",
    ...over,
  });
  beforeEach(() => {
    h = setup();
  });

  it("lista con importe, frecuencia y estado", async () => {
    h.api.rlist = [R(), R({ id: "r1", note: "Gimnasio", amount: 30, active: false }), R({ id: "r2", type: "income", amount: 1200, note: "Nómina", frequency: "yearly" })];
    await h.text("/recurrentes");
    const t = h.last("sendMessage")!.payload.text as string;
    assert.match(t, /🔁 Netflix · 12,99\s€\/mes · próximo 01\/12\/2026/);
    assert.match(t, /⏸ Gimnasio · 30,00\s€\/mes · pausado/);
    assert.match(t, /Nómina · \+1200,00\s€\/año/);
  });

  it("pausa, cambia importe y borra con confirmacion", async () => {
    h.api.rlist = [R()];
    await h.text("/recurrentes");
    await h.press(h.buttons(h.last("sendMessage"))[0]!);
    const kb = h.buttons(h.last("editMessageText"));
    await h.press(kb.find((b) => b.startsWith("rp:"))!);
    assert.deepEqual(h.api.rUpdated.at(-1), { id: "r0", edit: { active: false } });
    assert.match(h.last("editMessageText")!.payload.text, /Pausado/);
    await h.press(kb.find((b) => b.startsWith("ra:"))!);
    await h.text("x");
    assert.match(h.last("sendMessage")!.payload.text, /No entiendo ese importe/);
    await h.text("14,99");
    assert.deepEqual(h.api.rUpdated.at(-1), { id: "r0", edit: { amount: 14.99 } });
    await h.press(kb.find((b) => b.startsWith("rx:"))!);
    assert.equal(h.api.rDeleted.length, 0);
    await h.press(h.buttons(h.last("editMessageText")).find((b) => b.startsWith("ry:"))!);
    assert.deepEqual(h.api.rDeleted, ["r0"]);
  });

  it("crear: importe y concepto, categoria, frecuencia y primer cobro", async () => {
    await h.text("/nuevorecurrente");
    await h.text("pagar nada");
    assert.match(h.last("sendMessage")!.payload.text, /No he encontrado un importe/);
    await h.text("12,99 Netflix");
    const cats = h.buttons(h.last("sendMessage"));
    await h.press(cats[1]!); // Ocio
    await h.press(h.buttons(h.last("editMessageText"))[1]!); // mensual
    await h.press(h.buttons(h.last("editMessageText"))[1]!); // mañana
    assert.equal(h.api.rCreated.length, 1);
    assert.deepEqual({ ...h.api.rCreated[0]!, nextDate: "x" }, {
      type: "expense", amount: 12.99, categoryId: "c-ocio", frequency: "monthly", nextDate: "x", note: "Netflix",
    });
    assert.equal(h.api.rCreated[0]!.nextDate, dateInZone(-1, "Europe/Madrid"));
    assert.match(h.last("sendMessage")!.payload.text, /Pago recurrente guardado/);
  });

  it("crear un ingreso con fecha escrita", async () => {
    await h.text("/nuevorecurrente");
    await h.text("+1200 nómina");
    await h.press(h.buttons(h.last("sendMessage"))[0]!); // Nómina
    await h.press(h.buttons(h.last("editMessageText"))[1]!); // mensual
    await h.press(h.buttons(h.last("editMessageText"))[2]!); // otra fecha
    await h.text("ayer");
    assert.match(h.last("sendMessage")!.payload.text, /No entiendo esa fecha/);
    await h.text("01/12/2026");
    assert.equal(h.api.rCreated[0]!.type, "income");
    assert.equal(h.api.rCreated[0]!.nextDate, "2026-12-01");
  });
});

describe("comparativa con el mes anterior", () => {
  it("/resumen anade lo que ha cambiado frente al mes anterior", async () => {
    const h = setup();
    h.api.prevSummary = {
      period: "2026-10",
      income: 1000,
      expense: 200.5,
      balance: 799.5,
      expenseByCategory: [{ category: "Ocio", total: 100.5 }, { category: "Café", total: 100 }],
    };
    await h.text("/resumen");
    const t = h.last("sendMessage")!.payload.text as string;
    assert.match(t, /↔️ Frente a 2026-10:/);
    assert.match(t, /Gastos: 300,50\s€ \(\+50 %, \+100,00\s€\)/);
    assert.match(t, /Ingresos: 1200,00\s€ \(\+20 %, \+200,00\s€\)/);
    assert.match(t, /Café: -100,00\s€ \(-100 %\)/);
    assert.match(t, /Ocio: \+200,00\s€ \(\+199 %\)/);
  });

  it("sin datos del mes anterior no anade nada", async () => {
    const h = setup();
    const real = h.api.summary.bind(h.api);
    h.api.summary = async (r?: SummaryRange) =>
      r && "month" in r && r.month === "2026-09"
        ? { period: "2026-09", income: 0, expense: 0, balance: 0, expenseByCategory: [] }
        : real(r);
    await h.text("/resumen 2026-10");
    assert.ok(!(h.last("sendMessage")!.payload.text as string).includes("Frente a"));
  });
});
