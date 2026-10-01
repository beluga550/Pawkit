import { mount } from "svelte";
import App from "./App.svelte";
import { tauriApi } from "./lib/api.js";
import { createApp } from "./lib/app.js";
import "./styles/tokens.css";
import "./styles/base.css";

async function start() {
  // `npm run dev:mock` swaps in a fake server so the UI can be previewed in a browser.
  const api = import.meta.env.VITE_MOCK_API === "1" ? (await import("./lib/mock-api.js")).createMockApi() : tauriApi;
  mount(App, { target: document.getElementById("app"), props: { app: createApp({ api }) } });
}

start();
