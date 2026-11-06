import { createBot } from "./bot.js";
import { InputFile } from "grammy";
import { LedgerApi } from "./api.js";
import { summaryChart } from "./charts.js";
import { COMMANDS } from "./commands.js";
import { startReports, startWarrantyNotices } from "./scheduler.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Falta la variable de entorno ${name}`);
    process.exit(1);
  }
  return value;
}

const token = required("TELEGRAM_BOT_TOKEN");
const allowedId = Number(required("ALLOWED_TELEGRAM_ID"));
if (!Number.isSafeInteger(allowedId) || allowedId <= 0) {
  console.error("ALLOWED_TELEGRAM_ID debe ser un numero (tu ID de Telegram)");
  process.exit(1);
}
const apiKey = required("BOT_API_KEY");
const apiUrl = (process.env.LEDGER_API_URL ?? "http://ledger-api:8080").replace(/\/$/, "");
const timeZone = process.env.TZ ?? "Europe/Madrid";

const api = new LedgerApi(apiUrl, apiKey);
const bot = createBot({
  token,
  allowedId,
  api,
  timeZone,
  download: async (fileId) => {
    const file = await bot.api.getFile(fileId);
    if (!file.file_path) throw new Error("Telegram no devolvio file_path");
    const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Descarga de Telegram fallida: HTTP ${res.status}`);
    return res.arrayBuffer();
  },
});

// Informes automaticos: semanal (domingo 20:00) y mensual (dia 1, 09:00), hora de TZ.
const stopReports = startReports({
  api,
  timeZone,
  send: async (text) => {
    await bot.api.sendMessage(allowedId, text);
  },
  chart: (summary, title) => summaryChart(api, summary, title),
  sendImage: async (png) => {
    await bot.api.sendPhoto(allowedId, new InputFile(png, "informe.png"));
  },
});

// Aviso diario (10:00) de garantias que caducan en 30, 7 o 1 dias, o hoy.
const stopWarranties = startWarrantyNotices({
  api,
  timeZone,
  send: async (text) => {
    await bot.api.sendMessage(allowedId, text);
  },
});

const stop = () => {
  stopReports();
  stopWarranties();
  void bot.stop().finally(() => process.exit(0));
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

await bot.start({
  onStart: (me) => {
    console.log(`Bot @${me.username} escuchando (long polling)`);
    // Menu "/" con descripciones; si falla no es critico.
    bot.api.setMyCommands(COMMANDS.map((c) => ({ ...c }))).catch((err) => console.error("setMyCommands:", String(err).replaceAll(token, "***")));
  },
});
