import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface CategoryBreakdownItem {
	categoryId: string;
	name: string;
	total: number;
}

interface CategoryBreakdownChartProps {
	data: CategoryBreakdownItem[];
}

const currency = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function CategoryBreakdownChart({ data }: CategoryBreakdownChartProps) {
	if (data.length === 0) {
		return <p className="text-sm text-neutral-600">Sin gastos este mes.</p>;
	}

	return (
		<ResponsiveContainer width="100%" height={Math.max(160, data.length * 36)}>
			<BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
				<CartesianGrid horizontal={false} stroke="#2c2c2a" />
				<XAxis
					type="number"
					tick={{ fill: "#898781", fontSize: 12 }}
					tickFormatter={(value: number) => currency.format(value)}
					axisLine={{ stroke: "#383835" }}
					tickLine={false}
				/>
				<YAxis
					type="category"
					dataKey="name"
					width={110}
					tick={{ fill: "#c3c2b7", fontSize: 12 }}
					axisLine={false}
					tickLine={false}
				/>
				<Tooltip
					cursor={{ fill: "rgba(255,255,255,0.04)" }}
					contentStyle={{ background: "#1a1a19", border: "1px solid #2c2c2a", borderRadius: 6, fontSize: 12 }}
					labelStyle={{ color: "#ffffff" }}
					formatter={(value) => currency.format(Number(value))}
				/>
				<Bar dataKey="total" fill="#3987e5" radius={[0, 4, 4, 0]} maxBarSize={20} />
			</BarChart>
		</ResponsiveContainer>
	);
}
