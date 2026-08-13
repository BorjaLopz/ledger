export const MONTH_NAMES = [
	"Enero",
	"Febrero",
	"Marzo",
	"Abril",
	"Mayo",
	"Junio",
	"Julio",
	"Agosto",
	"Septiembre",
	"Octubre",
	"Noviembre",
	"Diciembre",
];

export function monthKey(year: number, month: number): string {
	return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function monthLabel(year: number, month: number): string {
	return `${MONTH_NAMES[month]} ${year}`;
}
