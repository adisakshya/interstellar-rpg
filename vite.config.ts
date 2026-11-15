import { resolve } from "node:path";
import { defineConfig } from "vite";

// GitHub Pages serves the site under /<repo>/ (ARCHITECTURE §9). Override with BASE_PATH for other hosts.
// spike/ is the SPIKE-001 measurement page, shipped so it can be opened on the reference phone.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/interstellar-rpg/",
  build: {
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        spike: resolve(import.meta.dirname, "spike/index.html"),
      },
    },
  },
});
