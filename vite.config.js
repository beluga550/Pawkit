import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";

// Same policy Tauri applies to the packaged app (src-tauri/tauri.conf.json).
const PRODUCTION_CSP =
  "default-src 'self'; img-src 'self' https://mc-heads.net; connect-src ipc: http://ipc.localhost";

export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  preview: {
    port: 4173,
    strictPort: true,
    headers: { "Content-Security-Policy": PRODUCTION_CSP },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.js"],
    setupFiles: ["./src/test-setup.js"],
  },
});
