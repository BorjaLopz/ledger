import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface AnnualBarDatum {
	month: string;
	income: number;
	expense: number;
}

interface AnnualBarChartProps {
	data: AnnualBarDatum[];
}

const currency = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function AnnualBarChart({ data }: AnnualBarChartProps) {
	return (
		<ResponsiveContainer width="100%" height={280}>
			<BarChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
				<CartesianGrid vertical={false} stroke="#2c2c2a" />
				<XAxis dataKey="month" tick={{ fill: "#898781", fontSize: 12 }} axisLine={{ stroke: "#383835" }} tickLine={false} />
				<YAxis
					tick={{ fill: "#898781", fontSize: 12 }}
					tickFormatter={(value: number) => currency.format(value)}
					axisLine={false}
					tickLine={false}
					width={64}
				/>
				<Tooltip
					cursor={{ fill: "rgba(255,255,255,0.04)" }}
					contentStyle={{ background: "#1a1a19", border: "1px solid #2c2c2a", borderRadius: 6, fontSize: 12 }}
					labelStyle={{ color: "#ffffff" }}
					formatter={(value) => currency.format(Number(value))}
				/>
				<Legend wrapperStyle={{ fontSize: 12, color: "#c3c2b7" }} />
				<Bar dataKey="income" name="Ingresos" fill="#3987e5" radius={[4, 4, 0, 0]} maxBarSize={18} />
				<Bar dataKey="expense" name="Gastos" fill="#d95926" radius={[4, 4, 0, 0]} maxBarSize={18} />
			</BarChart>
		</ResponsiveContainer>
	);
}
