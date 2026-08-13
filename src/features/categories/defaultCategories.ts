import type { Category } from "../../types/finance";

export const DEFAULT_CATEGORIES: Array<Omit<Category, "id" | "uid">> = [
	{ name: "Alimentación", icon: "ShoppingCart", color: "#f97316", type: "expense" },
	{ name: "Transporte", icon: "Car", color: "#3b82f6", type: "expense" },
	{ name: "Vivienda", icon: "Home", color: "#a855f7", type: "expense" },
	{ name: "Ocio", icon: "Gamepad2", color: "#ec4899", type: "expense" },
	{ name: "Salud", icon: "HeartPulse", color: "#ef4444", type: "expense" },
	{ name: "Compras", icon: "ShoppingBag", color: "#eab308", type: "expense" },
	{ name: "Suscripciones", icon: "Repeat", color: "#14b8a6", type: "expense" },
	{ name: "Otros", icon: "MoreHorizontal", color: "#6b7280", type: "expense" },
	{ name: "Nómina", icon: "Wallet", color: "#22c55e", type: "income" },
	{ name: "Freelance", icon: "Laptop", color: "#06b6d4", type: "income" },
	{ name: "Otros ingresos", icon: "PlusCircle", color: "#84cc16", type: "income" },
];
