import { InputFile, type Context } from "grammy";
import type { LedgerClient } from "./api.js";

/** Envia al chat el ticket guardado: como foto si Telegram puede mostrarla, si no (heic...) como archivo. */
export async function sendReceipt(ctx: Context, api: LedgerClient, url: string, caption?: string): Promise<void> {
  const bytes = new Uint8Array(await api.downloadReceipt(url));
  const ext = /\.([a-z0-9]+)(?:\?|$)/i.exec(url)?.[1]?.toLowerCase() ?? "jpg";
  const file = new InputFile(bytes, `ticket.${ext}`);
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) await ctx.replyWithPhoto(file, caption ? { caption } : undefined);
  else await ctx.replyWithDocument(file, caption ? { caption } : undefined);
}
