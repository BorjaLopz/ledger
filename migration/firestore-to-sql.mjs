// Exporta Firestore + Storage a un import.sql para el Postgres del NUC.
//
// Uso:
//   cd migration && npm install
//   node firestore-to-sql.mjs <service-account.json> <bucket> [directorio-salida]
//
// <bucket> es el de Firebase Storage, p. ej. "mi-proyecto.firebasestorage.app" o "mi-proyecto.appspot.com".
// Genera:  out/import.sql   y   out/receipts/<uid>/<fichero>  (tickets descargados)
// Es idempotente: se puede importar varias veces (ON CONFLICT DO NOTHING).
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const q = (value) => {
	if (value === null || value === undefined) return "NULL";
	return `'${String(value).replaceAll("\u0000", "").replaceAll("'", "''")}'`;
};
const num = (value) => {
	const n = Number(value);
	if (!Number.isFinite(n)) throw new Error(`Número no válido: ${value}`);
	return String(n);
};
const date = (value, ctx) => {
	if (typeof value !== "string" || !DATE_RE.test(value)) throw new Error(`Fecha no válida (${ctx}): ${value}`);
	return q(value);
};

/** "receipts/<uid>/<fichero>" a partir de una URL de descarga de Firebase Storage. */
export function objectPathFromUrl(url) {
	const match = /\/o\/([^?]+)/.exec(url ?? "");
	return match ? decodeURIComponent(match[1]) : null;
}

export const sanitizeFileName = (name) => name.replace(/[^A-Za-z0-9._-]/g, "_");

/**
 * @param data { categories, transactions, recurring, netWorth } arrays de { id, ...campos }
 * @param receiptMap Map<urlOriginal, "uid/fichero"> con la ruta nueva de cada ticket
 */
export function buildSql(data, receiptMap = new Map()) {
	const lines = ["BEGIN;"];

	for (const c of data.categories) {
		lines.push(
			`INSERT INTO categories (id, uid, name, color, icon, type) VALUES (${q(c.id)}, ${q(c.uid)}, ${q(c.name)}, ${q(c.color)}, ${q(c.icon)}, ${q(c.type)}) ON CONFLICT (id) DO NOTHING;`,
		);
	}

	for (const t of data.transactions) {
		const receiptPath = t.receiptUrl ? (receiptMap.get(t.receiptUrl) ?? null) : null;
		lines.push(
			`INSERT INTO transactions (id, uid, type, amount, category_id, date, note, receipt_path, recurring_id, created_at) VALUES (${q(t.id)}, ${q(t.uid)}, ${q(t.type)}, ${num(t.amount)}, ${q(t.categoryId)}, ${date(t.date, `transacción ${t.id}`)}, ${q(t.note ?? "")}, ${q(receiptPath)}, ${q(t.recurringId ?? null)}, ${t.createdAt ? `${q(t.createdAt)}::timestamptz` : "now()"}) ON CONFLICT (id) DO NOTHING;`,
		);
	}

	for (const r of data.recurring) {
		lines.push(
			`INSERT INTO recurring_payments (id, uid, type, amount, category_id, frequency, next_date, active, note) VALUES (${q(r.id)}, ${q(r.uid)}, ${q(r.type)}, ${num(r.amount)}, ${q(r.categoryId)}, ${q(r.frequency)}, ${date(r.nextDate, `recurrente ${r.id}`)}, ${r.active === false ? "FALSE" : "TRUE"}, ${q(r.note ?? "")}) ON CONFLICT (id) DO NOTHING;`,
		);
	}

	for (const e of data.netWorth) {
		const items = JSON.stringify((e.items ?? []).map((i) => ({ name: i.name, amount: Number(i.amount) })));
		lines.push(
			`INSERT INTO net_worth_entries (id, uid, date, items, total) VALUES (${q(e.id)}, ${q(e.uid)}, ${date(e.date, `patrimonio ${e.id}`)}, ${q(items)}::jsonb, ${num(e.total)}) ON CONFLICT (id) DO NOTHING;`,
		);
	}

	lines.push("COMMIT;");
	return `${lines.join("\n")}\n`;
}

async function main() {
	const [serviceAccountPath, bucketName, outDir = "out"] = process.argv.slice(2);
	if (!serviceAccountPath || !bucketName) {
		console.error("Uso: node firestore-to-sql.mjs <service-account.json> <bucket> [directorio-salida]");
		process.exit(1);
	}
	const { readFile } = await import("node:fs/promises");
	const { initializeApp, cert } = await import("firebase-admin/app");
	const { getFirestore } = await import("firebase-admin/firestore");
	const { getStorage } = await import("firebase-admin/storage");

	const serviceAccount = JSON.parse(await readFile(serviceAccountPath, "utf8"));
	initializeApp({ credential: cert(serviceAccount), storageBucket: bucketName });
	const db = getFirestore();
	const bucket = getStorage().bucket();

	const read = async (name) => (await db.collection(name).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
	const data = {
		categories: await read("categories"),
		transactions: await read("transactions"),
		recurring: await read("recurring"),
		netWorth: await read("netWorth"),
	};
	console.log(
		`Leídos: ${data.categories.length} categorías, ${data.transactions.length} transacciones, ${data.recurring.length} recurrentes, ${data.netWorth.length} patrimonio`,
	);

	const receiptMap = new Map();
	let failed = 0;
	for (const t of data.transactions) {
		if (!t.receiptUrl) continue;
		const objectPath = objectPathFromUrl(t.receiptUrl);
		const match = /^receipts\/([^/]+)\/(.+)$/.exec(objectPath ?? "");
		if (!match) {
			console.warn(`  ! URL de ticket no reconocida (transacción ${t.id}), se omite el ticket`);
			failed++;
			continue;
		}
		const [, uid, rawName] = match;
		const relative = `${uid}/${sanitizeFileName(rawName)}`;
		const dest = path.join(outDir, "receipts", relative);
		try {
			await mkdir(path.dirname(dest), { recursive: true });
			await bucket.file(objectPath).download({ destination: dest });
			receiptMap.set(t.receiptUrl, relative);
		} catch (err) {
			console.warn(`  ! No se pudo descargar ${objectPath}: ${err.message}`);
			failed++;
		}
	}

	await mkdir(outDir, { recursive: true });
	await writeFile(path.join(outDir, "import.sql"), buildSql(data, receiptMap));
	console.log(`Tickets descargados: ${receiptMap.size} (fallos: ${failed})`);
	console.log(`Generado ${path.join(outDir, "import.sql")}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
