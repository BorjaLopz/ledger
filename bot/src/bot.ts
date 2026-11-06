import { randomBytes } from "node:crypto";
import { Bot, InlineKeyboard, InputFile, type Context } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import { ApiError, type Category, type LedgerClient, type Tx } from "./api.js";
import { dateInZone, formatSummary, money, shortDate } from "./format.js";
import { COMMANDS } from "./commands.js";
import { registerCategories } from "./categories.js";
import { monthlyChart, summaryChart } from "./charts.js";
import { parsePeriod } from "./period.js";
import { parseEntry, type ParsedEntry } from "./parser.js";

export { dateInZone, money, COMMANDS };

export interface BotDeps {
  token: string;
  /** Unico usuario de Telegram al que responde el bot. */
  allowedId: number;
  api: LedgerClient;
  timeZone: string;
  /** Descarga un fichero de Telegram por su file_id. */
  download: (fileId: string) => Promise<ArrayBuffer>;
  /** Solo para tests: evita la llamada getMe. */
  botInfo?: UserFromGetMe;
}

interface PendingTx {
  kind: "tx";
  entry: ParsedEntry;
  cats: Category[];
  date?: string;
  expires: number;
}

interface PendingPhoto {
  kind: "photo";
  fileId: string;
  txId: string;
  filename: string;
  mime: string;
  expires: number;
}

type Pending = PendingTx | PendingPhoto;

const TTL_MS = 10 * 60 * 1000;
const TYPE_LABEL = { expense: "Gasto", income: "Ingreso" } as const;
const DAY_LABEL: Record<number, string> = { 1: "ayer", 2: "anteayer" };

const HELP = [
  "Mándame un gasto y elige la categoría con los botones:",
  "• 12,50 café",
  "• 45€ gasolina ayer",
  "• +1200 nómina (ingreso)",
  "",
  "Luego puedes enviarme una foto para guardarla como ticket del último movimiento.",
  "",
  ...COMMANDS.map((c) => `/${c.command}: ${c.description}`),
].join("\n");

const txLine = (t: Tx, categoryName?: string): string =>
  [money(t.amount), categoryName, t.note || undefined, shortDate(t.date)].filter(Boolean).join(" · ");

export function createBot(deps: BotDeps): Bot {
  const bot = new Bot(deps.token, deps.botInfo ? { botInfo: deps.botInfo } : undefined);
  const pending = new Map<string, Pending>();

  const put = (p: Pending): string => {
    const now = Date.now();
    for (const [key, value] of pending) if (value.expires < now) pending.delete(key);
    const id = randomBytes(4).toString("hex");
    pending.set(id, p);
    return id;
  };
  const get = (id: string): Pending | undefined => {
    const p = pending.get(id);
    return p && p.expires >= Date.now() ? p : undefined;
  };

  // Solo tu usuario, solo en chat privado. A cualquier otro no se le responde.
  bot.use(async (ctx, next) => {
    if (ctx.chat?.type !== "private" || ctx.from?.id !== deps.allowedId) return;
    await next();
  });

  const categories = registerCategories(bot, deps.api);

  bot.command(["start", "ayuda", "help"], (ctx) => ctx.reply(HELP));

  bot.command("resumen", async (ctx) => {
    const p = parsePeriod(ctx.match);
    if (!p) {
      await ctx.reply("Uso: /resumen · /resumen 2026-10 · /resumen 2026");
    } else if (p.kind === "year") {
      const s = await deps.api.summary({ from: `${p.year}-01-01`, to: `${p.year}-12-31` });
      await ctx.reply(formatSummary(s, `📊 Año ${p.year}`));
    } else {
      await ctx.reply(formatSummary(await deps.api.summary(p.kind === "month" ? { month: p.month } : undefined), "📊 Resumen"));
    }
  });

  bot.command("grafico", async (ctx) => {
    const p = parsePeriod(ctx.match);
    if (!p) {
      await ctx.reply("Uso: /grafico · /grafico 2026-10 · /grafico 2026");
      return;
    }
    const range =
      p.kind === "year" ? { from: `${p.year}-01-01`, to: `${p.year}-12-31` } : p.kind === "month" ? { month: p.month } : undefined;
    const title = p.kind === "year" ? `Año ${p.year}` : "Resumen";
    const s = await deps.api.summary(range);
    const png = await summaryChart(deps.api, s, title);
    if (!png) {
      await ctx.reply("No hay gastos en ese periodo, no hay nada que dibujar.");
      return;
    }
    await ctx.replyWithPhoto(new InputFile(png, "grafico.png"), { caption: formatSummary(s, "📊 " + title) });
  });

  bot.command("balance", async (ctx) => {
    const arg = ctx.match.trim();
    const months = arg ? Number(arg) : 12;
    if (!Number.isInteger(months) || months < 2 || months > 36) {
      await ctx.reply("Uso: /balance (12 meses) · /balance 6 (entre 2 y 36 meses)");
      return;
    }
    const png = await monthlyChart(deps.api, months, "Balance mensual");
    if (!png) {
      await ctx.reply("Todavía no hay movimientos en ese periodo.");
      return;
    }
    await ctx.replyWithPhoto(new InputFile(png, "balance.png"));
  });

  bot.command("exportar", async (ctx) => {
    const p = parsePeriod(ctx.match);
    if (!p) {
      await ctx.reply("Uso: /exportar (todo) · /exportar 2026-10 · /exportar 2026");
      return;
    }
    const arg = ctx.match.trim();
    const scope = p.kind === "month" ? { month: p.month } : p.kind === "year" ? { year: p.year } : undefined;
    const bytes = await deps.api.exportCsv(scope);
    await ctx.replyWithDocument(new InputFile(new Uint8Array(bytes), `ledger-${arg || "todo"}.csv`), {
      caption: "Separador «;» y decimales con coma: se abre directo en Excel.",
    });
  });

  bot.command("ultimo", async (ctx) => {
    const t = await deps.api.lastTransaction();
    if (!t) {
      await ctx.reply("Todavía no hay movimientos.");
      return;
    }
    const cats = await deps.api.categories();
    const name = cats.find((c) => c.id === t.categoryId)?.name;
    const kb = new InlineKeyboard().text("🗑 Borrar", `u:${t.id}`);
    await ctx.reply(`${TYPE_LABEL[t.type]}: ${txLine(t, name)}${t.receiptUrl ? " · 📎" : ""}`, { reply_markup: kb });
  });

  bot.on("message:text", async (ctx) => {
    if (await categories.handleText(ctx)) return;
    const text = ctx.message.text;
    if (text.startsWith("/")) {
      await ctx.reply("No conozco ese comando. /ayuda");
      return;
    }
    const entry = parseEntry(text);
    if (!entry) {
      await ctx.reply(`No he encontrado un importe.\n\n${HELP}`);
      return;
    }
    let cats = (await deps.api.categories()).filter((c) => c.type === entry.type);
    if (cats.length === 0) {
      await ctx.reply(`No tienes categorías de ${entry.type === "income" ? "ingresos" : "gastos"} en el Ledger.`);
      return;
    }
    // Si ya has usado esa misma nota antes, proponemos la categoria que mas has elegido.
    let suggested: Category | undefined;
    if (entry.note) {
      const hint = await deps.api.suggestCategory(entry.note, entry.type).catch(() => null);
      suggested = hint ? cats.find((c) => c.id === hint.categoryId) : undefined;
      if (suggested) cats = [suggested, ...cats.filter((c) => c.id !== suggested!.id)];
    }

    const date = entry.daysAgo > 0 ? dateInZone(entry.daysAgo, deps.timeZone) : undefined;
    const pid = put({ kind: "tx", entry, cats, date, expires: Date.now() + TTL_MS });

    const kb = new InlineKeyboard();
    let column = 0;
    cats.forEach((c, i) => {
      if (i === 0 && suggested) {
        kb.text(`⭐ ${c.name}`, `c:${pid}:0`).row();
        return;
      }
      kb.text(c.name, `c:${pid}:${i}`);
      if (++column % 2 === 0) kb.row();
    });
    kb.row().text("❌ Cancelar", `x:${pid}`);

    const day = DAY_LABEL[entry.daysAgo];
    const summary = [money(entry.amount), entry.note || "(sin nota)", day].filter(Boolean).join(" · ");
    const hintLine = suggested ? `\n💡 Sueles ponerlo en ${suggested.name}` : "";
    await ctx.reply(`${TYPE_LABEL[entry.type]}: ${summary}${hintLine}\nElige categoría:`, { reply_markup: kb });
  });

  bot.callbackQuery(/^c:([0-9a-f]+):(\d+)$/, async (ctx) => {
    const [, pid = "", idx = "0"] = ctx.match;
    const p = get(pid);
    if (!p || p.kind !== "tx") {
      await ctx.answerCallbackQuery({ text: "Caducado. Reenvía el gasto.", show_alert: true });
      await ctx.editMessageText("⌛ Caducado. Reenvía el gasto.").catch(() => undefined);
      return;
    }
    const cat = p.cats[Number(idx)];
    if (!cat) {
      await ctx.answerCallbackQuery();
      return;
    }
    await ctx.answerCallbackQuery();
    pending.delete(pid); // evita doble toque
    try {
      const t = await deps.api.createTransaction({
        type: p.entry.type,
        amount: p.entry.amount,
        categoryId: cat.id,
        note: p.entry.note,
        ...(p.date ? { date: p.date } : {}),
      });
      const kb = new InlineKeyboard().text("↩️ Deshacer", `u:${t.id}`);
      await ctx.editMessageText(
        `✅ Guardado\n${TYPE_LABEL[t.type]}: ${txLine(t, cat.name)}\n\n📎 Para adjuntar el ticket, envíame la foto ahora.`,
        { reply_markup: kb },
      );
    } catch (err) {
      pending.set(pid, p); // permite reintentar
      throw err;
    }
  });

  bot.callbackQuery(/^u:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const id = ctx.match[1] ?? "";
    const ok = await deps.api.deleteTransaction(id);
    await ctx.editMessageText(ok ? "🗑 Borrado." : "Ese movimiento ya no existe.");
  });

  bot.callbackQuery(/^x:([0-9a-f]+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    pending.delete(ctx.match[1] ?? "");
    await ctx.editMessageText("Cancelado ❌");
  });

  const handleImage = async (
    ctx: Context,
    fileId: string,
    filename: string,
    mime: string,
  ): Promise<void> => {
    const last = await deps.api.lastTransaction();
    if (!last) {
      await ctx.reply("No hay ningún movimiento al que asociar el ticket. Mándame primero el gasto.");
      return;
    }
    const pid = put({ kind: "photo", fileId, txId: last.id, filename, mime, expires: Date.now() + TTL_MS });
    const kb = new InlineKeyboard().text("✅ Adjuntar", `p:${pid}`).text("❌ No", `x:${pid}`);
    const warning = last.receiptUrl ? "\n⚠️ Ya tiene ticket: se reemplazará." : "";
    await ctx.reply(`¿Adjunto esta imagen como ticket de:\n${TYPE_LABEL[last.type]}: ${txLine(last)}?${warning}`, {
      reply_markup: kb,
    });
  };

  bot.on("message:photo", async (ctx) => {
    const photo = ctx.message.photo.at(-1); // la de mayor resolucion
    if (!photo) return;
    await handleImage(ctx, photo.file_id, "ticket.jpg", "image/jpeg");
  });

  bot.on("message:document", async (ctx) => {
    const doc = ctx.message.document;
    if (!doc.mime_type?.startsWith("image/")) {
      await ctx.reply("Solo puedo guardar imágenes (jpg, png, webp, heic) como ticket.");
      return;
    }
    await handleImage(ctx, doc.file_id, doc.file_name ?? "ticket", doc.mime_type);
  });

  bot.callbackQuery(/^p:([0-9a-f]+)$/, async (ctx) => {
    const pid = ctx.match[1] ?? "";
    const p = get(pid);
    if (!p || p.kind !== "photo") {
      await ctx.answerCallbackQuery({ text: "Caducado. Reenvía la foto.", show_alert: true });
      await ctx.editMessageText("⌛ Caducado. Reenvía la foto.").catch(() => undefined);
      return;
    }
    await ctx.answerCallbackQuery();
    pending.delete(pid);
    try {
      const bytes = await deps.download(p.fileId);
      await deps.api.attachReceipt(p.txId, bytes, p.filename, p.mime);
      await ctx.editMessageText("📎 Ticket guardado.");
    } catch (err) {
      pending.set(pid, p);
      throw err;
    }
  });

  bot.catch(async (err) => {
    const cause = err.error;
    const detail = cause instanceof ApiError ? `${cause.status} ${cause.message}` : "error inesperado";
    console.error(String(cause).replaceAll(deps.token, "***"));
    await err.ctx.reply(`⚠️ No he podido completarlo (${detail}). Inténtalo de nuevo.`).catch(() => undefined);
  });

  return bot;
}
