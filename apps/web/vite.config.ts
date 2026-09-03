import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const thirdPartyNoticesPath = resolve(
  import.meta.dirname,
  "../../THIRD_PARTY_NOTICES.txt",
);

export default defineConfig({
  root: import.meta.dirname,
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "third-party-notices",
      configureServer(server) {
        server.middlewares.use(
          "/THIRD_PARTY_NOTICES.txt",
          (_request, response) => {
            response.setHeader("Content-Type", "text/plain; charset=utf-8");
            response.end(readFileSync(thirdPartyNoticesPath));
          },
        );
      },
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "THIRD_PARTY_NOTICES.txt",
          source: readFileSync(thirdPartyNoticesPath, "utf8"),
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:3210",
    },
  },
  build: { outDir: "../../dist/web", emptyOutDir: true },
});
