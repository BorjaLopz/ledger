import { randomBytes } from "node:crypto";
import { InlineKeyboard, type Bot, type Context } from "grammy";
import { ApiError, type CategoryUsage, type LedgerClient } from "./api.js";

/** Iconos validos del frontend (lucide) con un emoji para elegirlos desde Telegram. */
export const ICONS: { name: string; emoji: string }[] = [
  { name: "ShoppingCart", emoji: "🛒" },
  { name: "Car", emoji: "🚗" },
  { name: "Home", emoji: "🏠" },
  { name: "Landmark", emoji: "🏛" },
  { name: "Zap", emoji: "⚡" },
  { name: "Droplet", emoji: "💧" },
  { name: "Flame", emoji: "🔥" },
  { name: "Wifi", emoji: "📶" },
  { name: "Phone", emoji: "📱" },
  { name: "Gamepad2", emoji: "🎮" },
  { name: "HeartPulse", emoji: "❤️" },
  { name: "ShoppingBag", emoji: "🛍" },
  { name: "Repeat", emoji: "🔁" },
  { name: "Wallet", emoji: "👛" },
  { name: "Laptop", emoji: "💻" },
  { name: "GraduationCap", emoji: "🎓" },
  { name: "Plane", emoji: "✈️" },
  { name: "Utensils", emoji: "🍴" },
  { name: "Dumbbell", emoji: "🏋️" },
  { name: "PawPrint", emoji: "🐾" },
  { name: "Gift", emoji: "🎁" },
  { name: "Shirt", emoji: "👕" },
  { name: "PlusCircle", emoji: "➕" },
  { name: "MoreHorizontal", emoji: "⋯" },
];

export const COLORS = [
  "#f97316", "#eab308", "#84cc16", "#22c55e", "#14b8a6", "#06b6d4",
  "#3b82f6", "#a855f7", "#ec4899", "#f43f5e", "#6b7280",
];

const emojiOf = (icon: string): string => ICONS.find((i) => i.name === icon)?.emoji ?? "🏷";

/** Color menos usado entre las categorias existentes (el primero en caso de empate). */
export function pickColor(existing: { color: string }[]): string {
  const count = new Map(COLORS.map((c) => [c, 0]));
  for (const c of existing) if (count.has(c.color)) count.set(c.color, count.get(c.color)! + 1);
  return COLORS.reduce((best, c) => (count.get(c)! < count.get(best)! ? c : best), COLORS[0]!);
}

const TTL_MS = 10 * 60 * 1000;
const TYPE_PLURAL = { expense: "Gastos", income: "Ingresos" } as const;

interface Flow {
  cats: CategoryUsage[];
  /** Tipo de la categoria que se esta creando. */
  newType?: "expense" | "income";
  /** Nombre ya escrito de la categoria que se esta creando (falta elegir icono). */
  newName?: string;
  /** Categoria sobre la que se esta cambiando el icono. */
  iconFor?: string;
  expires: number;
}

type Awaiting = { kind: "newName"; type: "expense" | "income" } | { kind: "rename"; id: string };

const usageText = (c: CategoryUsage): string => {
  const parts: string[] = [];
  if (c.transactions > 0) parts.push(`${c.transactions} mov.`);
  if (c.recurring > 0) parts.push(`${c.recurring} recurrente${c.recurring > 1 ? "s" : ""}`);
  return parts.length > 0 ? parts.join(", ") : "sin uso";
};

export function registerCategories(
  bot: Bot,
  api: LedgerClient,
): { handleText: (ctx: Context) => Promise<boolean> } {
  const flows = new Map<string, Flow>();
  let awaiting: Awaiting | null = null;

  const open = (cats: CategoryUsage[]): string => {
    const now = Date.now();
    for (const [k, v] of flows) if (v.expires < now) flows.delete(k);
    const id = randomBytes(4).toString("hex");
    flows.set(id, { cats, expires: now + TTL_MS });
    return id;
  };
  const flow = (id: string): Flow | undefined => {
    const f = flows.get(id);
    return f && f.expires >= Date.now() ? f : undefined;
  };
  const sorted = (cats: CategoryUsage[]): CategoryUsage[] =>
    [...cats].sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, "es") : a.type === "expense" ? -1 : 1));

  const listView = async (): Promise<{ text: string; kb: InlineKeyboard; pid: string }> => {
    const cats = sorted(await api.categoryUsage());
    const pid = open(cats);
    const lines: string[] = [];
    const kb = new InlineKeyboard();
    for (const type of ["expense", "income"] as const) {
      const group = cats.filter((c) => c.type === type);
      if (group.length === 0) continue;
      lines.push(`${TYPE_PLURAL[type]}:`);
      for (const c of group) lines.push(`${emojiOf(c.icon)} ${c.name} · ${usageText(c)}`);
      lines.push("");
    }
    cats.forEach((c, i) => {
      kb.text(`${emojiOf(c.icon)} ${c.name}`, `k:${pid}:${i}`);
      if (i % 2 === 1) kb.row();
    });
    kb.row().text("➕ Gasto", `kn:${pid}:e`).text("➕ Ingreso", `kn:${pid}:i`);
    return { text: `Tus categorías (toca una para editarla):\n\n${lines.join("\n").trim()}`, kb, pid };
  };

  const detailView = (pid: string, idx: number, c: CategoryUsage) => ({
    text: `${emojiOf(c.icon)} ${c.name}\n${c.type === "expense" ? "Gasto" : "Ingreso"} · ${usageText(c)}`,
    kb: new InlineKeyboard()
      .text("✏️ Renombrar", `kr:${pid}:${idx}`)
      .text("🎨 Icono", `ki:${pid}:${idx}`)
      .row()
      .text("🗑 Eliminar", `kd:${pid}:${idx}`)
      .text("⬅️ Volver", `kb:${pid}`),
  });

  const iconGrid = (pid: string): InlineKeyboard => {
    const kb = new InlineKeyboard();
    ICONS.forEach((icon, i) => {
      kb.text(icon.emoji, `i:${pid}:${i}`);
      if (i % 6 === 5) kb.row();
    });
    return kb;
  };

  const expired = async (ctx: Context): Promise<void> => {
    await ctx.answerCallbackQuery({ text: "Caducado. Vuelve a abrir /categorias.", show_alert: true });
    await ctx.editMessageText("⌛ Caducado. Usa /categorias otra vez.").catch(() => undefined);
  };

  /** Mensaje de error amigable para fallos de la API al crear/renombrar. */
  const conflict = (err: unknown): boolean => err instanceof ApiError && err.status === 409;

  bot.on("message::bot_command", async (ctx, next) => {
    awaiting = null; // cualquier comando cancela lo que se estaba esperando
    await next();
  });

  bot.command("categorias", async (ctx) => {
    const v = await listView();
    if (v.text.endsWith(":")) {
      await ctx.reply("No tienes categorías todavía. Crea una con /nuevacategoria");
      return;
    }
    await ctx.reply(v.text, { reply_markup: v.kb });
  });

  bot.command("nuevacategoria", async (ctx) => {
    const pid = open([]);
    const kb = new InlineKeyboard().text("Gasto", `kn:${pid}:e`).text("Ingreso", `kn:${pid}:i`);
    await ctx.reply("¿Qué tipo de categoría quieres crear?", { reply_markup: kb });
  });

  bot.command("cancelar", async (ctx) => {
    await ctx.reply("Vale, cancelado. 👍");
  });

  bot.callbackQuery(/^kb:([0-9a-f]+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const v = await listView();
    await ctx.editMessageText(v.text, { reply_markup: v.kb });
  });

  bot.callbackQuery(/^k:([0-9a-f]+):(\d+)$/, async (ctx) => {
    const [, pid = "", idx = "0"] = ctx.match;
    const f = flow(pid);
    const c = f?.cats[Number(idx)];
    if (!f || !c) return expired(ctx);
    await ctx.answerCallbackQuery();
    const v = detailView(pid, Number(idx), c);
    await ctx.editMessageText(v.text, { reply_markup: v.kb });
  });

  // Renombrar: pide el nombre nuevo como mensaje de texto.
  bot.callbackQuery(/^kr:([0-9a-f]+):(\d+)$/, async (ctx) => {
    const [, pid = "", idx = "0"] = ctx.match;
    const c = flow(pid)?.cats[Number(idx)];
    if (!c) return expired(ctx);
    await ctx.answerCallbackQuery();
    awaiting = { kind: "rename", id: c.id };
    await ctx.editMessageText(`Escribe el nuevo nombre para «${c.name}» (o /cancelar):`);
  });

  // Crear: tipo -> nombre (texto) -> icono (botones).
  bot.callbackQuery(/^kn:([0-9a-f]+):([ei])$/, async (ctx) => {
    const type = ctx.match[2] === "e" ? "expense" : "income";
    await ctx.answerCallbackQuery();
    awaiting = { kind: "newName", type };
    await ctx.editMessageText(
      `Nueva categoría de ${type === "expense" ? "gasto" : "ingreso"}. Escribe su nombre (o /cancelar):`,
    );
  });

  bot.callbackQuery(/^ki:([0-9a-f]+):(\d+)$/, async (ctx) => {
    const [, pid = "", idx = "0"] = ctx.match;
    const f = flow(pid);
    const c = f?.cats[Number(idx)];
    if (!f || !c) return expired(ctx);
    await ctx.answerCallbackQuery();
    f.iconFor = c.id;
    await ctx.editMessageText(`Elige el icono para «${c.name}»:`, { reply_markup: iconGrid(pid) });
  });

  bot.callbackQuery(/^i:([0-9a-f]+):(\d+)$/, async (ctx) => {
    const [, pid = "", idx = "0"] = ctx.match;
    const f = flow(pid);
    const icon = ICONS[Number(idx)];
    if (!f || !icon) return expired(ctx);
    await ctx.answerCallbackQuery();
    if (f.iconFor) {
      const c = await api.updateCategory(f.iconFor, { icon: icon.name });
      flows.delete(pid);
      await ctx.editMessageText(`${icon.emoji} «${c.name}» actualizada ✅`);
    } else if (f.newName && f.newType) {
      const all = await api.categories();
      try {
        const c = await api.createCategory({
          name: f.newName,
          type: f.newType,
          icon: icon.name,
          color: pickColor(all),
        });
        flows.delete(pid);
        await ctx.editMessageText(`${icon.emoji} «${c.name}» creada ✅`);
      } catch (err) {
        if (!conflict(err)) throw err;
        flows.delete(pid);
        await ctx.editMessageText("Ya existe una categoría con ese nombre. Prueba con /nuevacategoria.");
      }
    } else {
      await expired(ctx);
    }
  });

  // Eliminar: sin uso -> confirmar; con uso -> elegir a que categoria se mueven sus movimientos.
  bot.callbackQuery(/^kd:([0-9a-f]+):(\d+)$/, async (ctx) => {
    const [, pid = "", idx = "0"] = ctx.match;
    const f = flow(pid);
    const c = f?.cats[Number(idx)];
    if (!f || !c) return expired(ctx);
    await ctx.answerCallbackQuery();
    if (c.transactions === 0 && c.recurring === 0) {
      const kb = new InlineKeyboard().text("🗑 Sí, eliminar", `ky:${pid}:${idx}`).text("Cancelar", `k:${pid}:${idx}`);
      await ctx.editMessageText(`¿Eliminar «${c.name}»? No tiene movimientos.`, { reply_markup: kb });
      return;
    }
    const targets = f.cats.filter((t) => t.type === c.type && t.id !== c.id);
    if (targets.length === 0) {
      await ctx.editMessageText(
        `«${c.name}» tiene ${usageText(c)} y no hay otra categoría del mismo tipo a la que moverlos. Crea otra primero.`,
      );
      return;
    }
    const kb = new InlineKeyboard();
    f.cats.forEach((t, j) => {
      if (t.type !== c.type || t.id === c.id) return;
      kb.text(`${emojiOf(t.icon)} ${t.name}`, `km:${pid}:${idx}:${j}`).row();
    });
    kb.text("Cancelar", `k:${pid}:${idx}`);
    await ctx.editMessageText(
      `«${c.name}» tiene ${usageText(c)}.\nSi la eliminas, ¿a qué categoría los paso?`,
      { reply_markup: kb },
    );
  });

  bot.callbackQuery(/^ky:([0-9a-f]+):(\d+)$/, async (ctx) => {
    const [, pid = "", idx = "0"] = ctx.match;
    const f = flow(pid);
    const c = f?.cats[Number(idx)];
    if (!f || !c) return expired(ctx);
    await ctx.answerCallbackQuery();
    flows.delete(pid);
    try {
      await api.deleteCategory(c.id);
      await ctx.editMessageText(`🗑 «${c.name}» eliminada.`);
    } catch (err) {
      if (!conflict(err)) throw err;
      await ctx.editMessageText(`«${c.name}» ya tiene movimientos. Ábrela de nuevo desde /categorias.`);
    }
  });

  bot.callbackQuery(/^km:([0-9a-f]+):(\d+):(\d+)$/, async (ctx) => {
    const [, pid = "", idx = "0", to = "0"] = ctx.match;
    const f = flow(pid);
    const c = f?.cats[Number(idx)];
    const target = f?.cats[Number(to)];
    if (!f || !c || !target) return expired(ctx);
    await ctx.answerCallbackQuery();
    flows.delete(pid);
    const moved = await api.deleteCategory(c.id, target.id);
    await ctx.editMessageText(`🗑 «${c.name}» eliminada. ${moved} elemento(s) pasados a «${target.name}».`);
  });

  /** Texto libre mientras se espera un nombre. Devuelve true si lo ha consumido. */
  const handleText = async (ctx: Context): Promise<boolean> => {
    const wait = awaiting;
    const text = ctx.message?.text?.trim();
    if (!wait || !text) return false;
    if (text.length > 100) {
      await ctx.reply("Ese nombre es demasiado largo (máx. 100). Prueba con otro:");
      return true;
    }
    if (wait.kind === "rename") {
      try {
        const c = await api.updateCategory(wait.id, { name: text });
        awaiting = null;
        await ctx.reply(`✏️ Renombrada a «${c.name}» ✅`);
      } catch (err) {
        if (!conflict(err)) throw err;
        await ctx.reply("Ya tienes una categoría con ese nombre. Prueba con otro (o /cancelar):");
      }
      return true;
    }
    const existing = await api.categories();
    const norm = (s: string): string => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    if (existing.some((c) => c.type === wait.type && norm(c.name) === norm(text))) {
      await ctx.reply("Ya tienes una categoría con ese nombre. Prueba con otro (o /cancelar):");
      return true;
    }
    awaiting = null;
    const pid = open([]);
    const f = flows.get(pid)!;
    f.newType = wait.type;
    f.newName = text;
    await ctx.reply(`Elige un icono para «${text}»:`, { reply_markup: iconGrid(pid) });
    return true;
  };

  return { handleText };
}
