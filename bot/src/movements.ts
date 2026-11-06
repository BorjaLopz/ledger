import { randomBytes } from "node:crypto";
import { InlineKeyboard, type Bot, type Context } from "grammy";
import type { Category, LedgerClient, Tx } from "./api.js";
import { longDate, parseDate } from "./dates.js";
import { dateInZone, money, shortDate } from "./format.js";
import type { InputState } from "./input.js";
import { parseAmount } from "./parser.js";
import { sendReceipt } from "./receipts.js";

const TTL_MS = 10 * 60 * 1000;
const TYPE_LABEL = { expense: "Gasto", income: "Ingreso" } as const;

interface Flow {
  tx?: Tx;
  cats?: Category[];
  results?: Tx[];
  query?: string;
  expires: number;
}

export function registerMovements(bot: Bot, deps: { api: LedgerClient; input: InputState; timeZone: string }): void {
  const { api, input } = deps;
  const flows = new Map<string, Flow>();

  const open = (f: Omit<Flow, "expires">): string => {
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
    await ctx.answerCallbackQuery({ text: "Caducado. Vuelve a buscarlo.", show_alert: true });
    await ctx.editMessageText("⌛ Caducado. Vuelve a buscarlo.").catch(() => undefined);
  };
  const catName = (f: Flow, tx: Tx): string | undefined => f.cats?.find((c) => c.id === tx.categoryId)?.name;
  const label = (t: Tx, name?: string): string =>
    [money(t.amount), name, t.note || undefined, shortDate(t.date)].filter(Boolean).join(" · ");

  const detail = (pid: string, f: Flow): { text: string; kb: InlineKeyboard } => {
    const t = f.tx!;
    const kb = new InlineKeyboard()
      .text("✏️ Importe", `ma:${pid}`)
      .text("🏷 Categoría", `mc:${pid}`)
      .row()
      .text("📅 Fecha", `md:${pid}`)
      .text("📝 Nota", `mn:${pid}`)
      .row();
    if (t.receiptUrl) kb.text("🖼 Ticket", `mt:${pid}`);
    kb.text("🗑 Borrar", `mx:${pid}`);
    if (f.results) kb.row().text("⬅️ Volver", `mb:${pid}`);
    const text = `${TYPE_LABEL[t.type]}: ${label(t, catName(f, t))}${t.receiptUrl ? " · 📎" : ""}\nFecha completa: ${longDate(t.date)}`;
    return { text, kb };
  };

  const refresh = async (pid: string, f: Flow, tx: Tx): Promise<void> => {
    f.tx = tx;
    if (f.results) f.results = f.results.map((r) => (r.id === tx.id ? tx : r));
  };

  const openDetail = async (ctx: Context, tx: Tx, results?: Tx[], query?: string): Promise<void> => {
    const cats = await api.categories();
    const pid = open({ tx, cats, results, query });
    const v = detail(pid, flows.get(pid)!);
    await ctx.reply(v.text, { reply_markup: v.kb });
  };

  // ---------- /ultimo ----------
  bot.command("ultimo", async (ctx) => {
    const t = await api.lastTransaction();
    if (!t) {
      await ctx.reply("Todavía no hay movimientos.");
      return;
    }
    const cats = await api.categories();
    const pid = open({ tx: t, cats });
    const name = cats.find((c) => c.id === t.categoryId)?.name;
    const kb = new InlineKeyboard().text("✏️ Editar", `me:${pid}`).text("🗑 Borrar", `u:${t.id}`);
    await ctx.reply(`${TYPE_LABEL[t.type]}: ${label(t, name)}${t.receiptUrl ? " · 📎" : ""}`, { reply_markup: kb });
  });

  bot.callbackQuery(/^me:([0-9a-f]+)$/, async (ctx) => {
    const pid = ctx.match[1] ?? "";
    const f = flow(pid);
    if (!f?.tx) return expired(ctx);
    await ctx.answerCallbackQuery();
    const v = detail(pid, f);
    await ctx.editMessageText(v.text, { reply_markup: v.kb });
  });

  // ---------- /buscar ----------
  bot.command("buscar", async (ctx) => {
    const q = ctx.match.trim();
    if (!q) {
      await ctx.reply("Uso: /buscar café · /buscar 12,50 · /buscar supermercado\nBusca en la nota, la categoría o el importe exacto.");
      return;
    }
    const results = await api.searchTransactions(q, 8);
    if (results.length === 0) {
      await ctx.reply(`No he encontrado nada con «${q}».`);
      return;
    }
    const cats = await api.categories();
    const pid = open({ results, cats, query: q });
    await ctx.reply(...resultsView(pid, flows.get(pid)!));
  });

  const resultsView = (pid: string, f: Flow): [string, { reply_markup: InlineKeyboard }] => {
    const kb = new InlineKeyboard();
    f.results!.forEach((t, i) => kb.text(label(t, catName(f, t)).slice(0, 48), `s:${pid}:${i}`).row());
    return [`🔎 «${f.query}»: ${f.results!.length} resultado${f.results!.length === 1 ? "" : "s"} (los más recientes primero)`, { reply_markup: kb }];
  };

  bot.callbackQuery(/^s:([0-9a-f]+):(\d+)$/, async (ctx) => {
    const [, pid = "", idx = "0"] = ctx.match;
    const f = flow(pid);
    const t = f?.results?.[Number(idx)];
    if (!f || !t) return expired(ctx);
    await ctx.answerCallbackQuery();
    f.tx = t;
    const v = detail(pid, f);
    await ctx.editMessageText(v.text, { reply_markup: v.kb });
  });

  bot.callbackQuery(/^mb:([0-9a-f]+)$/, async (ctx) => {
    const pid = ctx.match[1] ?? "";
    const f = flow(pid);
    if (!f?.results) return expired(ctx);
    await ctx.answerCallbackQuery();
    const [text, opts] = resultsView(pid, f);
    await ctx.editMessageText(text, opts);
  });

  // ---------- Editar ----------
  const edited = async (ctx: Context, pid: string, f: Flow, tx: Tx): Promise<void> => {
    await refresh(pid, f, tx);
    const v = detail(pid, f);
    await ctx.reply(`✅ Actualizado\n${v.text}`, { reply_markup: v.kb });
  };

  bot.callbackQuery(/^ma:([0-9a-f]+)$/, async (ctx) => {
    const pid = ctx.match[1] ?? "";
    const f = flow(pid);
    if (!f?.tx) return expired(ctx);
    await ctx.answerCallbackQuery();
    input.set(async (c2) => {
      const amount = parseAmount((c2.message?.text ?? "").trim());
      if (amount === null || amount <= 0) {
        await c2.reply("No entiendo ese importe. Escribe algo como 12,50 (o /cancelar):");
        return;
      }
      input.clear();
      await edited(c2, pid, f, await api.editTransaction(f.tx!.id, { amount }));
    });
    await ctx.editMessageText(`Importe actual: ${money(f.tx.amount)}. Escribe el nuevo importe (o /cancelar):`);
  });

  bot.callbackQuery(/^md:([0-9a-f]+)$/, async (ctx) => {
    const pid = ctx.match[1] ?? "";
    const f = flow(pid);
    if (!f?.tx) return expired(ctx);
    await ctx.answerCallbackQuery();
    input.set(async (c2) => {
      const date = parseDate(c2.message?.text ?? "", dateInZone(0, deps.timeZone));
      if (!date) {
        await c2.reply("No entiendo esa fecha (o es futura). Prueba: 15/03/2025, «hoy» o «ayer» (o /cancelar):");
        return;
      }
      input.clear();
      await edited(c2, pid, f, await api.editTransaction(f.tx!.id, { date }));
    });
    await ctx.editMessageText(`Fecha actual: ${longDate(f.tx.date)}. Escribe la nueva (15/03/2025, «ayer»…):`);
  });

  bot.callbackQuery(/^mn:([0-9a-f]+)$/, async (ctx) => {
    const pid = ctx.match[1] ?? "";
    const f = flow(pid);
    if (!f?.tx) return expired(ctx);
    await ctx.answerCallbackQuery();
    input.set(async (c2) => {
      const raw = (c2.message?.text ?? "").trim();
      if (!raw) return;
      if (raw.length > 500) {
        await c2.reply("Demasiado largo (máx. 500). Prueba con algo más corto:");
        return;
      }
      input.clear();
      await edited(c2, pid, f, await api.editTransaction(f.tx!.id, { note: raw === "-" ? "" : raw }));
    });
    await ctx.editMessageText(`Nota actual: ${f.tx.note || "(vacía)"}. Escribe la nueva (o «-» para dejarla vacía):`);
  });

  bot.callbackQuery(/^mc:([0-9a-f]+)$/, async (ctx) => {
    const pid = ctx.match[1] ?? "";
    const f = flow(pid);
    if (!f?.tx || !f.cats) return expired(ctx);
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard();
    let col = 0;
    f.cats.forEach((c, i) => {
      if (c.type !== f.tx!.type) return;
      kb.text(c.name, `mk:${pid}:${i}`);
      if (++col % 2 === 0) kb.row();
    });
    kb.row().text("Cancelar", `me:${pid}`);
    await ctx.editMessageText("Elige la nueva categoría:", { reply_markup: kb });
  });

  bot.callbackQuery(/^mk:([0-9a-f]+):(\d+)$/, async (ctx) => {
    const [, pid = "", idx = "0"] = ctx.match;
    const f = flow(pid);
    const c = f?.cats?.[Number(idx)];
    if (!f?.tx || !c) return expired(ctx);
    await ctx.answerCallbackQuery();
    await refresh(pid, f, await api.editTransaction(f.tx.id, { categoryId: c.id }));
    const v = detail(pid, f);
    await ctx.editMessageText(`✅ Actualizado\n${v.text}`, { reply_markup: v.kb });
  });

  bot.callbackQuery(/^mt:([0-9a-f]+)$/, async (ctx) => {
    const f = flow(ctx.match[1] ?? "");
    if (!f?.tx?.receiptUrl) return expired(ctx);
    await ctx.answerCallbackQuery();
    await sendReceipt(ctx, api, f.tx.receiptUrl, label(f.tx, catName(f, f.tx)));
  });

  bot.callbackQuery(/^mx:([0-9a-f]+)$/, async (ctx) => {
    const pid = ctx.match[1] ?? "";
    const f = flow(pid);
    if (!f?.tx) return expired(ctx);
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard().text("🗑 Sí, borrar", `my:${pid}`).text("Cancelar", `me:${pid}`);
    await ctx.editMessageText(`¿Borrar este movimiento?\n${label(f.tx, catName(f, f.tx))}${f.tx.receiptUrl ? "\nTambién se borrará su ticket." : ""}`, { reply_markup: kb });
  });

  bot.callbackQuery(/^my:([0-9a-f]+)$/, async (ctx) => {
    const pid = ctx.match[1] ?? "";
    const f = flow(pid);
    if (!f?.tx) return expired(ctx);
    await ctx.answerCallbackQuery();
    flows.delete(pid);
    const ok = await api.deleteTransaction(f.tx.id);
    await ctx.editMessageText(ok ? "🗑 Borrado." : "Ese movimiento ya no existe.");
  });
}
