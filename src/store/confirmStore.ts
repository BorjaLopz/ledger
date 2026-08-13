import { create } from "zustand";

interface ConfirmState {
	isOpen: boolean;
	message: string;
	resolve: ((value: boolean) => void) | null;
	request: (message: string) => Promise<boolean>;
	handleConfirm: () => void;
	handleCancel: () => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
	isOpen: false,
	message: "",
	resolve: null,
	request: (message) =>
		new Promise<boolean>((resolve) => {
			set({ isOpen: true, message, resolve });
		}),
	handleConfirm: () => {
		get().resolve?.(true);
		set({ isOpen: false, resolve: null });
	},
	handleCancel: () => {
		get().resolve?.(false);
		set({ isOpen: false, resolve: null });
	},
}));

export function useConfirm() {
	return useConfirmStore((state) => state.request);
}
