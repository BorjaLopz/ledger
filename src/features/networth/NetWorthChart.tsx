import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface NetWorthChartProps {
	data: Array<{ date: string; total: number }>;
}

const currency = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function NetWorthChart({ data }: NetWorthChartProps) {
	if (data.length === 0) {
		return <p className="text-sm text-neutral-600">Sin registros todavía.</p>;
	}

	return (
		<ResponsiveContainer width="100%" height={280}>
			<LineChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
				<CartesianGrid vertical={false} stroke="#2c2c2a" />
				<XAxis dataKey="date" tick={{ fill: "#898781", fontSize: 12 }} axisLine={{ stroke: "#383835" }} tickLine={false} />
				<YAxis
					tick={{ fill: "#898781", fontSize: 12 }}
					tickFormatter={(value: number) => currency.format(value)}
					axisLine={false}
					tickLine={false}
					width={72}
				/>
				<Tooltip
					contentStyle={{ background: "#1a1a19", border: "1px solid #2c2c2a", borderRadius: 6, fontSize: 12 }}
					labelStyle={{ color: "#ffffff" }}
					formatter={(value) => currency.format(Number(value))}
				/>
				<Line type="monotone" dataKey="total" name="Patrimonio" stroke="#3987e5" strokeWidth={2} dot={{ r: 3 }} />
			</LineChart>
		</ResponsiveContainer>
	);
}
