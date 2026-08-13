const dateFormatter = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("es-ES", {
	day: "numeric",
	month: "long",
	year: "numeric",
	hour: "2-digit",
	minute: "2-digit",
});

export function formatDate(dateString: string): string {
	const [year, month, day] = dateString.split("-").map(Number);
	return dateFormatter.format(new Date(year, month - 1, day));
}

export function formatDateTime(isoString: string): string {
	return dateTimeFormatter.format(new Date(isoString));
}
