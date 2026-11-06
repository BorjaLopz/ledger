import { randomBytes } from "node:crypto";
import { InlineKeyboard, type Bot, type Context } from "grammy";
import type { LedgerClient, Warranty } from "./api.js";
import { addDays, longDate, parseDate } from "./dates.js";
import { dateInZone } from "./format.js";
import type { InputState } from "./input.js";
import { sendReceipt } from "./receipts.js";

const TTL_MS = 10 * 60 * 1000;

export interface WarrantyDeps {
  api: LedgerClient;
  input: InputState;
  timeZone: string;
  download: (fileId: string) => Promise<ArrayBuffer>;
}

interface Flow {
  /** Lista de garantias (para la vista de listado) */
  list?: Warranty[];
  name?: string;
  date?: string;
  /** Para confirmar una foto */
  file?: { fileId: string; filename: string; mime: string; warrantyId: string };
  expires: number;
}

/** "12" -> "1 año", "24" -> "2 años", "18" -> "18 meses" */
export function durationLabel(months: number): string {
  if (months % 12 === 0) return months === 12 ? "1 año" : `${months / 12} años`;
  return `${months} meses`;
}

export function daysLabel(daysLeft: number): string {
  if (daysLeft < 0) return `caducó hace ${-daysLeft} día${daysLeft === -1 ? "" : "s"}`;
  if (daysLeft === 0) return "caduca HOY";
  if (daysLeft === 1) return "caduca mañana";
  if (daysLeft < 90) return `caduca en ${daysLeft} días`;
  const months = Math.round(daysLeft / 30.4);
  return months < 24 ? `caduca en ${months} meses` : `caduca en ${(daysLeft / 365).toFixed(1).replace(".", ",")} años`;
}

const statusEmoji = (w: Warranty): string => (w.daysLeft < 0 ? "❌" : w.daysLeft <= 30 ? "⚠️" : "✅");

const line = (w: Warranty): string =>
  `${statusEmoji(w)} ${w.name} · ${daysLabel(w.daysLeft)} (${longDate(w.expiresOn)})${w.receiptUrl ? " 📎" : ""}`;

export function registerWarranties(bot: Bot, deps: WarrantyDeps): { offerPhoto: (ctx: Context, fileId: string, filename: string, mime: string) => Promise<boolean> } {
  const { api, input } = deps;
  const flows = new Map<string, Flow>();
  /** Garantia a la que irá la próxima foto (tras crearla o pulsar "Adjuntar ticket"). */
  let photoTarget: { id: string; name: string; expires: number } | null = null;

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
  const today = (): string => dateInZone(0, deps.timeZone);

  const expired = async (ctx: Context): Promise<void> => {
    await ctx.answerCallbackQuery({ text: "Caducado. Vuelve a empezar.", show_alert: true });
    await ctx.editMessageText("⌛ Caducado. Vuelve a empezar.").catch(() => undefined);
  };

  // ---------- Listado ----------
  const listView = async (): Promise<{ text: string; kb: InlineKeyboard } | null> => {
    const list = await api.warranties();
    if (list.length === 0) return null;
    const pid = open({ list });
    const kb = new InlineKeyboard();
    list.forEach((w, i) => kb.text(`${statusEmoji(w)} ${w.name}`.slice(0, 40), `w:${pid}:${i}`).row());
    kb.text("➕ Nueva garantía", `wn:${pid}`);
    return { text: `🛡 Tus garantías (las que antes caducan, primero):\n\n${list.map(line).join("\n")}`, kb };
  };

  bot.command("garantias", async (ctx) => {
    const v = await listView();
    if (!v) {
      await ctx.reply("No tienes garantías guardadas. Crea una con /nuevagarantia");
      return;
    }
    await ctx.reply(v.text, { reply_markup: v.kb });
  });

  bot.callbackQuery(/^wb:([0-9a-f]+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const v = await listView();
    await ctx.editMessageText(v ? v.text : "No tienes garantías guardadas. Crea una con /nuevagarantia", v ? { reply_markup: v.kb } : undefined);
  });

  bot.callbackQuery(/^w:([0-9a-f]+):(\d+)$/, async (ctx) => {
    const [, pid = "", idx = "0"] = ctx.match;
    const f = flow(pid);
    const w = f?.list?.[Number(idx)];
    if (!w) return expired(ctx);
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard().text("📎 Adjuntar ticket", `wa:${pid}:${idx}`);
    if (w.receiptUrl) kb.text("🖼 Ver ticket", `wv:${pid}:${idx}`);
    kb.row().text("🗑 Eliminar", `wd:${pid}:${idx}`).text("⬅️ Volver", `wb:${pid}`);
    const extra = [`Comprado el ${longDate(w.purchaseDate)} · garantía de ${durationLabel(w.months)}`, w.note].filter(Boolean);
    await ctx.editMessageText(`🛡 ${w.name}\n${line(w)}\n${extra.join("\n")}`, { reply_markup: kb });
  });

  bot.callbackQuery(/^wa:([0-9a-f]+):(\d+)$/, async (ctx) => {
    const [, pid = "", idx = "0"] = ctx.match;
    const w = flow(pid)?.list?.[Number(idx)];
    if (!w) return expired(ctx);
    await ctx.answerCallbackQuery();
    photoTarget = { id: w.id, name: w.name, expires: Date.now() + TTL_MS };
    await ctx.editMessageText(`📎 Envíame ahora la foto del ticket de «${w.name}».`);
  });

  bot.callbackQuery(/^wv:([0-9a-f]+):(\d+)$/, async (ctx) => {
    const [, pid = "", idx = "0"] = ctx.match;
    const w = flow(pid)?.list?.[Number(idx)];
    if (!w?.receiptUrl) return expired(ctx);
    await ctx.answerCallbackQuery();
    await sendReceipt(ctx, api, w.receiptUrl, `Ticket de ${w.name}`);
  });

  bot.callbackQuery(/^wd:([0-9a-f]+):(\d+)$/, async (ctx) => {
    const [, pid = "", idx = "0"] = ctx.match;
    const w = flow(pid)?.list?.[Number(idx)];
    if (!w) return expired(ctx);
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard().text("🗑 Sí, eliminar", `wy:${pid}:${idx}`).text("Cancelar", `w:${pid}:${idx}`);
    await ctx.editMessageText(`¿Eliminar la garantía de «${w.name}»?${w.receiptUrl ? " También se borrará su ticket." : ""}`, { reply_markup: kb });
  });

  bot.callbackQuery(/^wy:([0-9a-f]+):(\d+)$/, async (ctx) => {
    const [, pid = "", idx = "0"] = ctx.match;
    const w = flow(pid)?.list?.[Number(idx)];
    if (!w) return expired(ctx);
    await ctx.answerCallbackQuery();
    flows.delete(pid);
    const ok = await api.deleteWarranty(w.id);
    await ctx.editMessageText(ok ? `🗑 Garantía de «${w.name}» eliminada.` : "Esa garantía ya no existe.");
  });

  // ---------- Crear: nombre -> fecha -> duracion ----------
  const askName = async (ctx: Context): Promise<void> => {
    input.set(onName);
    await ctx.reply("¿Qué producto es? Escribe su nombre (o /cancelar):");
  };

  bot.command("nuevagarantia", askName);

  bot.callbackQuery(/^wn:([0-9a-f]+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    input.set(onName);
    await ctx.editMessageText("¿Qué producto es? Escribe su nombre (o /cancelar):");
  });

  const onName = async (ctx: Context): Promise<void> => {
    const name = ctx.message?.text?.trim();
    if (!name) return;
    if (name.length > 100) {
      await ctx.reply("Ese nombre es demasiado largo (máx. 100). Prueba con otro:");
      return;
    }
    input.clear();
    const pid = open({ name });
    const kb = new InlineKeyboard()
      .text("Hoy", `wf:${pid}:0`)
      .text("Ayer", `wf:${pid}:1`)
      .text("📅 Otra fecha", `wf:${pid}:o`);
    await ctx.reply(`¿Cuándo compraste «${name}»?`, { reply_markup: kb });
  };

  const durationKb = (pid: string): InlineKeyboard =>
    new InlineKeyboard()
      .text("1 año", `wm:${pid}:12`)
      .text("2 años", `wm:${pid}:24`)
      .text("3 años", `wm:${pid}:36`)
      .row()
      .text("5 años", `wm:${pid}:60`)
      .text("✏️ Otros meses", `wm:${pid}:o`);

  bot.callbackQuery(/^wf:([0-9a-f]+):([01o])$/, async (ctx) => {
    const [, pid = "", which = "0"] = ctx.match;
    const f = flow(pid);
    if (!f?.name) return expired(ctx);
    await ctx.answerCallbackQuery();
    if (which === "o") {
      input.set(async (c2) => {
        const date = parseDate(c2.message?.text ?? "", today());
        if (!date) {
          await c2.reply("No entiendo esa fecha (o es futura). Prueba: 15/03/2025, «hoy» o «ayer» (o /cancelar):");
          return;
        }
        input.clear();
        f.date = date;
        await c2.reply(`Compra el ${longDate(date)}. ¿Cuánto dura la garantía?`, { reply_markup: durationKb(pid) });
      });
      await ctx.editMessageText("Escribe la fecha de compra (15/03/2025, «hoy», «ayer»…):");
      return;
    }
    f.date = addDays(today(), -Number(which));
    await ctx.editMessageText(`Compra el ${longDate(f.date)}. ¿Cuánto dura la garantía?`, { reply_markup: durationKb(pid) });
  });

  const create = async (ctx: Context, f: Flow, months: number): Promise<void> => {
    const w = await api.createWarranty({ name: f.name!, purchaseDate: f.date!, months });
    photoTarget = { id: w.id, name: w.name, expires: Date.now() + TTL_MS };
    await ctx.reply(`✅ Garantía guardada\n${line(w)}\n\n📎 Si quieres, envíame ahora la foto del ticket para guardarla con la garantía.`);
  };

  bot.callbackQuery(/^wm:([0-9a-f]+):(\d+|o)$/, async (ctx) => {
    const [, pid = "", m = "12"] = ctx.match;
    const f = flow(pid);
    if (!f?.name || !f.date) return expired(ctx);
    await ctx.answerCallbackQuery();
    if (m === "o") {
      input.set(async (c2) => {
        const months = Number(c2.message?.text?.trim());
        if (!Number.isInteger(months) || months < 1 || months > 120) {
          await c2.reply("Escribe un número de meses entre 1 y 120 (o /cancelar):");
          return;
        }
        input.clear();
        flows.delete(pid);
        await create(c2, f, months);
      });
      await ctx.editMessageText("¿Cuántos meses dura la garantía? (1–120)");
      return;
    }
    flows.delete(pid); // evita doble toque
    await ctx.editMessageText(`Guardando «${f.name}»…`);
    try {
      await create(ctx, f, Number(m));
    } catch (err) {
      flows.set(pid, f); // permite reintentar
      throw err;
    }
  });

  // ---------- Fotos de ticket para una garantia ----------
  const offerPhoto = async (ctx: Context, fileId: string, filename: string, mime: string): Promise<boolean> => {
    if (!photoTarget || photoTarget.expires < Date.now()) {
      photoTarget = null;
      return false;
    }
    const pid = open({ file: { fileId, filename, mime, warrantyId: photoTarget.id } });
    const kb = new InlineKeyboard().text("✅ Adjuntar", `wp:${pid}`).text("❌ No", `wq:${pid}`);
    await ctx.reply(`¿Guardo esta imagen como ticket de la garantía «${photoTarget.name}»?`, { reply_markup: kb });
    return true;
  };

  bot.callbackQuery(/^wq:([0-9a-f]+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    flows.delete(ctx.match[1] ?? "");
    photoTarget = null; // la siguiente foto vuelve a ir al ultimo movimiento
    await ctx.editMessageText("Vale, no la guardo.");
  });

  bot.callbackQuery(/^wp:([0-9a-f]+)$/, async (ctx) => {
    const pid = ctx.match[1] ?? "";
    const f = flow(pid);
    if (!f?.file) return expired(ctx);
    await ctx.answerCallbackQuery();
    flows.delete(pid);
    try {
      const bytes = await deps.download(f.file.fileId);
      await api.attachWarrantyReceipt(f.file.warrantyId, bytes, f.file.filename, f.file.mime);
      photoTarget = null;
      await ctx.editMessageText("📎 Ticket guardado con la garantía.");
    } catch (err) {
      flows.set(pid, f);
      throw err;
    }
  });

  return { offerPhoto };
}
