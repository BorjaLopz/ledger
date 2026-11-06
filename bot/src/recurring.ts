import { randomBytes } from "node:crypto";
import { InlineKeyboard, type Bot, type Context } from "grammy";
import type { Category, Frequency, LedgerClient, Recurring } from "./api.js";
import { addDays, longDate, parseUpcoming } from "./dates.js";
import { dateInZone, money } from "./format.js";
import type { InputState } from "./input.js";
import { parseAmount, parseEntry, type ParsedEntry } from "./parser.js";

const TTL_MS = 10 * 60 * 1000;
const PER = { weekly: "/semana", monthly: "/mes", yearly: "/año" } as const;
const FREQ_NAME = { weekly: "semanal", monthly: "mensual", yearly: "anual" } as const;
const FREQ_CODE: Record<string, Frequency> = { w: "weekly", m: "monthly", y: "yearly" };

interface Flow {
  list?: Recurring[];
  cats?: Category[];
  entry?: ParsedEntry;
  category?: Category;
  frequency?: Frequency;
  expires: number;
}

export function registerRecurring(bot: Bot, deps: { api: LedgerClient; input: InputState; timeZone: string }): void {
  const { api, input } = deps;
  const flows = new Map<string, Flow>();
  const today = (): string => dateInZone(0, deps.timeZone);

  const open = (f: Omit<Flow, "expires"> = {}): string => {
    const now = Date.now();
    for (const [k, v] of flows) if (v.expires < now) flows.delete(k);
    const id = randomBytes(4).toString("hex");
    flows.set(id, { ...f, expires: now + TTL_MS });
    return id;
  };
  const flow = (id: string): Flow | undefined => {
    const f = flows.get(id);
    return f && f.expires >= Date.now() ? f : undefined;
  };
  const expired = async (ctx: Context): Promise<void> => {
    await ctx.answerCallbackQuery({ text: "Caducado. Vuelve a empezar.", show_alert: true });
    await ctx.editMessageText("⌛ Caducado. Vuelve a empezar.").catch(() => undefined);
  };

  const sign = (r: { type: string }): string => (r.type === "income" ? "+" : "");
  const title = (r: Recurring, cats: Category[]): string =>
    r.note || cats.find((c) => c.id === r.categoryId)?.name || "Sin concepto";
  const line = (r: Recurring, cats: Category[]): string =>
    `${r.active ? "🔁" : "⏸"} ${title(r, cats)} · ${sign(r)}${money(r.amount)}${PER[r.frequency]} · ${
      r.active ? `próximo ${longDate(r.nextDate)}` : "pausado"
    }`;

  // ---------- Listado y detalle ----------
  const listView = async (): Promise<{ text: string; kb: InlineKeyboard }> => {
    const [list, cats] = await Promise.all([api.recurring(), api.categories()]);
    const pid = open({ list, cats });
    const kb = new InlineKeyboard();
    list.forEach((r, i) => kb.text(`${r.active ? "🔁" : "⏸"} ${title(r, cats)}`.slice(0, 40), `r:${pid}:${i}`).row());
    kb.text("➕ Nuevo", `rn:${pid}`);
    const text = list.length > 0 ? `🔁 Pagos recurrentes:\n\n${list.map((r) => line(r, cats)).join("\n")}` : "No tienes pagos recurrentes todavía.";
    return { text, kb };
  };

  bot.command("recurrentes", async (ctx) => {
    const v = await listView();
    await ctx.reply(v.text, { reply_markup: v.kb });
  });

  bot.callbackQuery(/^rb:([0-9a-f]+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const v = await listView();
    await ctx.editMessageText(v.text, { reply_markup: v.kb });
  });

  const detail = (pid: string, idx: number, f: Flow): { text: string; kb: InlineKeyboard } => {
    const r = f.list![idx]!;
    const kb = new InlineKeyboard()
      .text(r.active ? "⏸ Pausar" : "▶️ Reanudar", `rp:${pid}:${idx}`)
      .text("✏️ Importe", `ra:${pid}:${idx}`)
      .row()
      .text("🗑 Eliminar", `rx:${pid}:${idx}`)
      .text("⬅️ Volver", `rb:${pid}`);
    const cat = f.cats?.find((c) => c.id === r.categoryId)?.name;
    return { text: `${line(r, f.cats ?? [])}\nCategoría: ${cat ?? "?"} · ${FREQ_NAME[r.frequency]}`, kb };
  };

  bot.callbackQuery(/^r:([0-9a-f]+):(\d+)$/, async (ctx) => {
    const [, pid = "", idx = "0"] = ctx.match;
    const f = flow(pid);
    if (!f?.list?.[Number(idx)]) return expired(ctx);
    await ctx.answerCallbackQuery();
    const v = detail(pid, Number(idx), f);
    await ctx.editMessageText(v.text, { reply_markup: v.kb });
  });

  bot.callbackQuery(/^rp:([0-9a-f]+):(\d+)$/, async (ctx) => {
    const [, pid = "", idx = "0"] = ctx.match;
    const f = flow(pid);
    const r = f?.list?.[Number(idx)];
    if (!f || !r) return expired(ctx);
    await ctx.answerCallbackQuery();
    const updated = await api.updateRecurring(r.id, { active: !r.active });
    f.list![Number(idx)] = updated;
    const v = detail(pid, Number(idx), f);
    await ctx.editMessageText(`${updated.active ? "▶️ Reanudado" : "⏸ Pausado"}\n${v.text}`, { reply_markup: v.kb });
  });

  bot.callbackQuery(/^ra:([0-9a-f]+):(\d+)$/, async (ctx) => {
    const [, pid = "", idx = "0"] = ctx.match;
    const f = flow(pid);
    const r = f?.list?.[Number(idx)];
    if (!f || !r) return expired(ctx);
    await ctx.answerCallbackQuery();
    input.set(async (c2) => {
      const amount = parseAmount((c2.message?.text ?? "").trim());
      if (amount === null || amount <= 0) {
        await c2.reply("No entiendo ese importe. Escribe algo como 12,99 (o /cancelar):");
        return;
      }
      input.clear();
      f.list![Number(idx)] = await api.updateRecurring(r.id, { amount });
      const v = detail(pid, Number(idx), f);
      await c2.reply(`✅ Importe actualizado\n${v.text}`, { reply_markup: v.kb });
    });
    await ctx.editMessageText(`Importe actual: ${money(r.amount)}${PER[r.frequency]}. Escribe el nuevo (o /cancelar):`);
  });

  bot.callbackQuery(/^rx:([0-9a-f]+):(\d+)$/, async (ctx) => {
    const [, pid = "", idx = "0"] = ctx.match;
    const r = flow(pid)?.list?.[Number(idx)];
    if (!r) return expired(ctx);
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard().text("🗑 Sí, eliminar", `ry:${pid}:${idx}`).text("Cancelar", `r:${pid}:${idx}`);
    await ctx.editMessageText("¿Eliminar este pago recurrente? Los movimientos ya registrados se quedan.", { reply_markup: kb });
  });

  bot.callbackQuery(/^ry:([0-9a-f]+):(\d+)$/, async (ctx) => {
    const [, pid = "", idx = "0"] = ctx.match;
    const r = flow(pid)?.list?.[Number(idx)];
    if (!r) return expired(ctx);
    await ctx.answerCallbackQuery();
    flows.delete(pid);
    const ok = await api.deleteRecurring(r.id);
    await ctx.editMessageText(ok ? "🗑 Pago recurrente eliminado." : "Ese pago ya no existe.");
  });

  // ---------- Crear: importe+concepto -> categoria -> frecuencia -> primer cobro ----------
  const onEntry = async (ctx: Context): Promise<void> => {
    const entry = parseEntry(ctx.message?.text ?? "");
    if (!entry) {
      await ctx.reply("No he encontrado un importe. Prueba con «12,99 Netflix» (o /cancelar):");
      return;
    }
    const cats = (await api.categories()).filter((c) => c.type === entry.type);
    if (cats.length === 0) {
      input.clear();
      await ctx.reply(`No tienes categorías de ${entry.type === "income" ? "ingresos" : "gastos"}. Crea una con /nuevacategoria`);
      return;
    }
    input.clear();
    const pid = open({ entry, cats });
    const kb = new InlineKeyboard();
    cats.forEach((c, i) => {
      kb.text(c.name, `rc:${pid}:${i}`);
      if (i % 2 === 1) kb.row();
    });
    kb.row().text("❌ Cancelar", `rz:${pid}`);
    const what = [`${sign(entry)}${money(entry.amount)}`, entry.note].filter(Boolean).join(" · ");
    await ctx.reply(`${entry.type === "income" ? "Ingreso" : "Gasto"} recurrente: ${what}\nElige categoría:`, { reply_markup: kb });
  };

  const ask = async (ctx: Context): Promise<void> => {
    input.set(onEntry);
    await ctx.reply("Escribe el importe y el concepto, por ejemplo «12,99 Netflix» (con + delante si es un ingreso, p. ej. «+1200 nómina»). O /cancelar:");
  };
  bot.command("nuevorecurrente", ask);

  bot.callbackQuery(/^rn:([0-9a-f]+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    input.set(onEntry);
    await ctx.editMessageText("Escribe el importe y el concepto, por ejemplo «12,99 Netflix» (con + delante si es un ingreso). O /cancelar:");
  });

  bot.callbackQuery(/^rz:([0-9a-f]+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    flows.delete(ctx.match[1] ?? "");
    await ctx.editMessageText("Cancelado ❌");
  });

  bot.callbackQuery(/^rc:([0-9a-f]+):(\d+)$/, async (ctx) => {
    const [, pid = "", idx = "0"] = ctx.match;
    const f = flow(pid);
    const cat = f?.cats?.[Number(idx)];
    if (!f || !cat) return expired(ctx);
    await ctx.answerCallbackQuery();
    f.category = cat;
    const kb = new InlineKeyboard()
      .text("Cada semana", `rf:${pid}:w`)
      .text("Cada mes", `rf:${pid}:m`)
      .text("Cada año", `rf:${pid}:y`);
    await ctx.editMessageText(`Categoría: ${cat.name}. ¿Cada cuánto se repite?`, { reply_markup: kb });
  });

  const dateKb = (pid: string): InlineKeyboard =>
    new InlineKeyboard().text("Hoy", `rd:${pid}:0`).text("Mañana", `rd:${pid}:1`).text("📅 Otra fecha", `rd:${pid}:o`);

  bot.callbackQuery(/^rf:([0-9a-f]+):([wmy])$/, async (ctx) => {
    const [, pid = "", code = "m"] = ctx.match;
    const f = flow(pid);
    if (!f?.category) return expired(ctx);
    await ctx.answerCallbackQuery();
    f.frequency = FREQ_CODE[code];
    await ctx.editMessageText("¿Cuándo es el próximo cobro?", { reply_markup: dateKb(pid) });
  });

  const create = async (ctx: Context, f: Flow, nextDate: string): Promise<void> => {
    const r = await api.createRecurring({
      type: f.entry!.type,
      amount: f.entry!.amount,
      categoryId: f.category!.id,
      frequency: f.frequency!,
      nextDate,
      note: f.entry!.note,
    });
    const todayNote = nextDate === today() ? "\nEl cobro de hoy ya está registrado." : "";
    await ctx.reply(`✅ Pago recurrente guardado\n${line(r, f.cats ?? [])}${todayNote}`);
  };

  bot.callbackQuery(/^rd:([0-9a-f]+):([01o])$/, async (ctx) => {
    const [, pid = "", which = "0"] = ctx.match;
    const f = flow(pid);
    if (!f?.entry || !f.category || !f.frequency) return expired(ctx);
    await ctx.answerCallbackQuery();
    if (which === "o") {
      input.set(async (c2) => {
        const date = parseUpcoming(c2.message?.text ?? "", today());
        if (!date) {
          await c2.reply("No entiendo esa fecha (o ya pasó). Prueba: 15/12/2026, «mañana»… (o /cancelar):");
          return;
        }
        input.clear();
        flows.delete(pid);
        await create(c2, f, date);
      });
      await ctx.editMessageText("Escribe la fecha del próximo cobro (15/12/2026, «mañana»…):");
      return;
    }
    flows.delete(pid); // evita doble toque
    await ctx.editMessageText("Guardando…");
    try {
      await create(ctx, f, addDays(today(), Number(which)));
    } catch (err) {
      flows.set(pid, f);
      throw err;
    }
  });
}
