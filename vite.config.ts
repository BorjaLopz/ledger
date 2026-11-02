import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		// en desarrollo, /api se redirige al backend local
		proxy: { "/api": "http://localhost:8080" },
	},
});
