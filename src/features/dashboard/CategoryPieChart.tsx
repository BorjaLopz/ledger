import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface PieDatum {
	name: string;
	total: number;
}

interface CategoryPieChartProps {
	data: PieDatum[];
}

const CATEGORICAL_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9"];
const OTHER_COLOR = "#6b7280";
const currency = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function CategoryPieChart({ data }: CategoryPieChartProps) {
	if (data.length === 0) {
		return <p className="text-sm text-neutral-600">Sin datos.</p>;
	}

	const sorted = [...data].sort((a, b) => b.total - a.total);
	const top = sorted.slice(0, 7);
	const rest = sorted.slice(7);
	const restTotal = rest.reduce((sum, entry) => sum + entry.total, 0);
	const sliceData = restTotal > 0 ? [...top, { name: "Otros", total: restTotal }] : top;

	return (
		<ResponsiveContainer width="100%" height={280}>
			<PieChart>
				<Pie data={sliceData} dataKey="total" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
					{sliceData.map((entry, index) => (
						<Cell
							key={entry.name}
							fill={index < top.length ? CATEGORICAL_DARK[index] : OTHER_COLOR}
							stroke="#1a1a19"
							strokeWidth={2}
						/>
					))}
				</Pie>
				<Tooltip
					contentStyle={{ background: "#1a1a19", border: "1px solid #2c2c2a", borderRadius: 6, fontSize: 12 }}
					labelStyle={{ color: "#ffffff" }}
					formatter={(value) => currency.format(Number(value))}
				/>
				<Legend wrapperStyle={{ fontSize: 12, color: "#c3c2b7" }} />
			</PieChart>
		</ResponsiveContainer>
	);
}
