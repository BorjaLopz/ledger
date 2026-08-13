import { onAuthStateChanged } from "firebase/auth";
import { useEffect } from "react";
import { auth } from "../lib/firebase";
import { useAuthStore } from "../store/authStore";

export function AuthListener() {
	const setUser = useAuthStore((state) => state.setUser);

	useEffect(() => {
		return onAuthStateChanged(auth, setUser);
	}, [setUser]);

	return null;
}
