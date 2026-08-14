import { signOut } from "firebase/auth";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LedgerLogo } from "../components/LedgerLogo";
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
	const [menuOpen, setMenuOpen] = useState(false);
	const location = useLocation();

	useEffect(() => {
		setMenuOpen(false);
	}, [location.pathname]);

	return (
		<div className="flex h-screen flex-col overflow-x-hidden bg-neutral-950 text-neutral-100">
			<nav className="relative flex shrink-0 items-center justify-between border-b border-neutral-800 px-4 py-4 sm:px-8">
				<div className="flex items-center gap-6">
					<div className="flex items-center gap-2">
						<LedgerLogo />
						<span className="text-sm font-bold" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
							Ledger
						</span>
					</div>
					<div className="hidden items-center gap-6 md:flex">
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
				</div>

				<button
					type="button"
					onClick={() => signOut(auth)}
					className="hidden text-sm text-neutral-400 hover:text-neutral-100 md:block"
				>
					Salir
				</button>

				<button
					type="button"
					onClick={() => setMenuOpen((open) => !open)}
					className="text-neutral-400 hover:text-neutral-100 md:hidden"
					aria-label="Abrir menú"
				>
					{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
				</button>

				{menuOpen && (
					<div className="absolute left-0 right-0 top-full z-40 border-b border-neutral-800 bg-neutral-950 md:hidden">
						<div className="flex flex-col gap-1 p-2">
							{links.map((link) => (
								<NavLink
									key={link.to}
									to={link.to}
									end={link.to === "/"}
									onClick={() => setMenuOpen(false)}
									className={({ isActive }) =>
										`rounded-md px-3 py-2.5 text-sm ${isActive ? "bg-neutral-900 text-neutral-100" : "text-neutral-400"}`
									}
								>
									{link.label}
								</NavLink>
							))}
							<button
								type="button"
								onClick={() => {
									setMenuOpen(false);
									signOut(auth);
								}}
								className="mt-1 rounded-md px-3 py-2.5 text-left text-sm text-neutral-400 hover:bg-neutral-900"
							>
								Salir
							</button>
						</div>
					</div>
				)}
			</nav>
			<div className="min-h-0 flex-1">
				<Outlet />
			</div>
		</div>
	);
}
