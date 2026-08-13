import { zodResolver } from "@hookform/resolvers/zod";
import { type AuthError, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { LedgerLogo } from "../../components/LedgerLogo";
import { auth, googleProvider } from "../../lib/firebase";

const loginSchema = z.object({
	email: z.string().email("Email no válido"),
	password: z.string().min(6, "Mínimo 6 caracteres"),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
	const navigate = useNavigate();
	const [error, setError] = useState<string | null>(null);
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

	async function onSubmit(data: LoginForm) {
		setError(null);
		try {
			await signInWithEmailAndPassword(auth, data.email, data.password);
			navigate("/");
		} catch {
			setError("Email o contraseña incorrectos");
		}
	}

	async function onGoogleSignIn() {
		setError(null);
		try {
			await signInWithPopup(auth, googleProvider);
			navigate("/");
		} catch (err) {
			setError((err as AuthError).message);
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 text-neutral-100">
			<div className="w-full max-w-sm space-y-6">
				<div className="flex flex-col items-center gap-3">
					<LedgerLogo className="h-9 w-9" />
					<h1 className="text-2xl font-medium">ledger</h1>
				</div>

				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<div>
						<label htmlFor="email" className="mb-1 block text-sm text-neutral-400">
							Email
						</label>
						<input
							id="email"
							type="email"
							autoComplete="email"
							className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-600"
							{...register("email")}
						/>
						{errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
					</div>

					<div>
						<label htmlFor="password" className="mb-1 block text-sm text-neutral-400">
							Contraseña
						</label>
						<input
							id="password"
							type="password"
							autoComplete="current-password"
							className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-600"
							{...register("password")}
						/>
						{errors.password && (
							<p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
						)}
					</div>

					{error && <p className="text-sm text-red-400">{error}</p>}

					<button
						type="submit"
						disabled={isSubmitting}
						className="w-full rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-white disabled:opacity-50"
					>
						Entrar
					</button>
				</form>

				<div className="flex items-center gap-3 text-xs text-neutral-600">
					<div className="h-px flex-1 bg-neutral-800" />o<div className="h-px flex-1 bg-neutral-800" />
				</div>

				<button
					type="button"
					onClick={onGoogleSignIn}
					className="w-full rounded-md border border-neutral-800 px-3 py-2 text-sm font-medium hover:bg-neutral-900"
				>
					Continuar con Google
				</button>
			</div>
		</div>
	);
}
