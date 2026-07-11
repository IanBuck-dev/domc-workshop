import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react(), tailwind()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:3210" },
  },
  build: { outDir: "../../dist/web", emptyOutDir: true },
});
