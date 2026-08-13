import { signOut } from "firebase/auth";
import { NavLink, Outlet } from "react-router-dom";
import { useRecurringSync } from "../features/recurring/useRecurringSync";
import { auth } from "../lib/firebase";

const links = [
	{ to: "/", label: "Resumen" },
	{ to: "/transacciones", label: "Transacciones" },
	{ to: "/recurrentes", label: "Recurrentes" },
	{ to: "/dashboard", label: "Dashboard" },
	{ to: "/patrimonio", label: "Patrimonio" },
	{ to: "/categorias", label: "Categorías" },
];

export function AppLayout() {
	useRecurringSync();

	return (
		<div className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
			<nav className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-8 py-4">
				<div className="flex items-center gap-6">
					<span className="text-sm font-medium">ledger</span>
					{links.map((link) => (
						<NavLink
							key={link.to}
							to={link.to}
							end={link.to === "/"}
							className={({ isActive }) => `text-sm ${isActive ? "text-neutral-100" : "text-neutral-500 hover:text-neutral-300"}`}
						>
							{link.label}
						</NavLink>
					))}
				</div>
				<button type="button" onClick={() => signOut(auth)} className="text-sm text-neutral-400 hover:text-neutral-100">
					Salir
				</button>
			</nav>
			<div className="min-h-0 flex-1">
				<Outlet />
			</div>
		</div>
	);
}
