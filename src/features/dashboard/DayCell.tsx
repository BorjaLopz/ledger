import { useState } from "react";
import type { DayBreakdown } from "./dailyBreakdown";

interface DayCellProps {
	day: number;
	breakdown?: DayBreakdown;
	size?: "sm" | "lg";
}

const currency = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function DayCell({ day, breakdown, size = "sm" }: DayCellProps) {
	const [hovered, setHovered] = useState(false);
	const categories = breakdown?.categories ?? [];
	const hasSpend = Boolean(breakdown && breakdown.total > 0);

	return (
		<div
			className={`relative flex flex-col rounded-md border border-neutral-800 ${size === "lg" ? "min-h-24 p-2" : "aspect-square p-1.5"} ${hasSpend ? "bg-neutral-900" : "bg-neutral-950"}`}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			<span className="text-xs text-neutral-500">{day}</span>
			{categories.length > 0 && (
				<div className="mt-1 flex flex-wrap gap-1">
					{categories.slice(0, size === "lg" ? 10 : 5).map((category) => (
						<span
							key={category.categoryId}
							className="h-1.5 w-1.5 rounded-full"
							style={{ backgroundColor: category.color }}
						/>
					))}
				</div>
			)}
			{hasSpend && breakdown && (
				<span className="mt-auto text-[10px] tabular-nums text-neutral-500">{currency.format(breakdown.total)}</span>
			)}

			{hovered && hasSpend && breakdown && (
				<div className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 w-48 -translate-x-1/2 rounded-md border border-neutral-700 bg-neutral-900 p-2 shadow-[0px_8px_20px_rgba(0,0,0,0.4)]">
					<p className="mb-1 text-xs font-medium text-neutral-200">{currency.format(breakdown.total)}</p>
					<div className="space-y-1">
						{categories.map((category) => (
							<div key={category.categoryId} className="flex items-center justify-between gap-2 text-xs">
								<span className="flex items-center gap-1.5 text-neutral-400">
									<span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: category.color }} />
									{category.name}
								</span>
								<span className="tabular-nums text-neutral-200">{currency.format(category.total)}</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
