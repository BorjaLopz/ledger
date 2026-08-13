import { AnimatePresence, motion } from "framer-motion";
import { useConfirmStore } from "../store/confirmStore";

export function ConfirmDialog() {
	const isOpen = useConfirmStore((state) => state.isOpen);
	const message = useConfirmStore((state) => state.message);
	const handleConfirm = useConfirmStore((state) => state.handleConfirm);
	const handleCancel = useConfirmStore((state) => state.handleCancel);

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.15 }}
					onClick={handleCancel}
				>
					<motion.div
						className="w-full max-w-sm rounded-lg border border-neutral-800 bg-neutral-900 p-5 shadow-[0px_16px_40px_rgba(0,0,0,0.5)]"
						initial={{ opacity: 0, scale: 0.95, y: 8 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 8 }}
						transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
						onClick={(event) => event.stopPropagation()}
					>
						<p className="mb-5 text-sm text-neutral-100">{message}</p>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={handleCancel}
								className="flex-1 rounded-md bg-neutral-800 px-3 py-2 text-sm text-neutral-100 hover:bg-neutral-700"
							>
								Cancelar
							</button>
							<button
								type="button"
								onClick={handleConfirm}
								className="flex-1 rounded-md bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-400"
							>
								Borrar
							</button>
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
