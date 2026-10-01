import { render } from "@testing-library/svelte";
import { vi } from "vitest";
import { createApp } from "./lib/app.js";
import { appContext } from "./lib/context.js";

/** In-memory stand-in for localStorage. `map` exposes the raw stored strings. */
export function memoryBackend(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
}

export function failingBackend() {
  return {
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
}

/** A fake backend. Flip `api.server.online` to simulate the RCON link dropping. */
export function fakeApi() {
  const server = {
    online: true,
    players: ["Steve", "Alex"],
    max: 20,
    bans: { playersOutput: "There are no bans", ipsOutput: "There are no bans", players: [], ips: [] },
    whitelist: { output: "There are no whitelisted players", players: [] },
    failNext: null,
    reply: (action) => `ok ${action.type}`,
  };
  const offline = () => ({ kind: "disconnected", message: "RCON 连接中断" });
  return {
    server,
    connect: vi.fn(async () => {
      if (!server.online) throw offline();
    }),
    reconnect: vi.fn(async () => {
      if (!server.online) throw offline();
    }),
    disconnect: vi.fn(async () => {}),
    query: vi.fn(async ({ type }) => {
      if (!server.online) throw offline();
      if (type === "onlinePlayers") {
        return {
          output: `There are ${server.players.length} of a max of ${server.max} players online: ${server.players.join(", ")}`,
          players: [...server.players],
          max: server.max,
        };
      }
      if (type === "bans") return structuredClone(server.bans);
      if (type === "whitelist") return structuredClone(server.whitelist);
      throw { kind: "internal", message: `unknown query ${type}` };
    }),
    perform: vi.fn(async (action) => {
      if (server.failNext) {
        const error = server.failNext;
        server.failNext = null;
        throw error;
      }
      if (!server.online) throw offline();
      return server.reply(action);
    }),
  };
}

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** Let pending promise callbacks run (works with fake timers too). */
export async function settle() {
  for (let index = 0; index < 10; index += 1) await Promise.resolve();
}

export function testApp({ api = fakeApi(), backend = memoryBackend() } = {}) {
  return createApp({ api, backend });
}

/** Render a component that calls useApp(). */
export function renderInApp(Component, props = {}, app = testApp()) {
  return { app, ...render(Component, { props, context: appContext(app) }) };
}
