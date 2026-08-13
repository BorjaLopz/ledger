interface StatTileProps {
	label: string;
	value: string;
	tone?: "default" | "good" | "bad";
}

const TONE_CLASSES: Record<NonNullable<StatTileProps["tone"]>, string> = {
	default: "text-neutral-100",
	good: "text-green-400",
	bad: "text-red-400",
};

export function StatTile({ label, value, tone = "default" }: StatTileProps) {
	return (
		<div className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
			<p className="text-sm text-neutral-500">{label}</p>
			<p className={`mt-1 text-2xl font-medium tabular-nums ${TONE_CLASSES[tone]}`}>{value}</p>
		</div>
	);
}
