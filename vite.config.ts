import { defineConfig } from "vite";

// GitHub Pages serves the site under /<repo>/ (ARCHITECTURE §9). Override with BASE_PATH for other hosts.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/interstellar-rpg/",
  build: { target: "es2022", sourcemap: true },
});
