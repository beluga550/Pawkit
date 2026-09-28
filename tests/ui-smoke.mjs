import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

class Element {
  constructor() {
    this.value = "";
    this.textContent = "";
    this.disabled = false;
    this.children = [];
    this.listeners = new Map();
    this.classList = { toggle() {} };
  }

  addEventListener(name, listener, options = {}) {
    const listeners = this.listeners.get(name) ?? [];
    listeners.push({ listener, once: options.once });
    this.listeners.set(name, listeners);
  }

  dispatch(name) {
    const listeners = this.listeners.get(name) ?? [];
    this.listeners.set(name, listeners.filter(({ once }) => !once));
    return Promise.all(listeners.map(({ listener }) => listener({ preventDefault() {} })));
  }

  replaceChildren() { this.children = []; }
  append(...children) { this.children.push(...children); }
  showModal() { this.open = true; }
}

test("connection, fixed actions, confirmation, and automatic recovery", async () => {
  const elements = new Map();
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  const storage = new Map();
  const calls = [];
  let online = true;
  let tick;
  const window = new Element();
  window.__TAURI__ = {
    core: {
      async invoke(command, args) {
        calls.push({ command, args });
        if (!online) throw { kind: "disconnected", message: "RCON 连接中断" };
        if (command === "list_players") return { players: ["Steve", "Alex"], output: "2 players online: Steve, Alex" };
        if (command === "broadcast") return "Broadcast sent";
        if (command.startsWith("teleport_")) return "Teleported";
      },
    },
  };
  const context = {
    window,
    document: {
      getElementById: get,
      querySelectorAll: () => [get("say-submit"), get("tp-player-submit"), get("tp-coords-submit")],
      createElement: () => new Element(),
    },
    navigator: {},
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    setInterval: (callback) => { tick = callback; },
    Date,
    Number,
    String,
  };
  vm.runInNewContext(readFileSync(new URL("../src/main.js", import.meta.url), "utf8"), context);
  await window.dispatch("DOMContentLoaded");

  get("server-name").value = "Test";
  get("server-host").value = "127.0.0.1";
  get("server-port").value = "25575";
  get("server-password").value = "secret";
  await get("connection-form").dispatch("submit");
  assert.equal(get("status-pill").textContent, "已连接");
  assert.equal(get("player-count").textContent, "2");
  assert.equal(get("server-password").value, "");
  assert.equal(storage.get("pawkit.profile.v1").includes("secret"), false);

  get("say-message").value = "Hello players";
  await get("say-form").dispatch("submit");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.some(({ command, args }) => command === "broadcast" && args.message === "Hello players"), true);

  get("tp-player-source").value = "Steve";
  get("tp-player-destination").value = "Alex";
  await get("tp-player-form").dispatch("submit");
  assert.equal(calls.some(({ command }) => command === "teleport_to_player"), false);
  get("confirm-dialog").returnValue = "confirm";
  await get("confirm-dialog").dispatch("close");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.some(({ command }) => command === "teleport_to_player"), true);

  const teleportCount = calls.filter(({ command }) => command.startsWith("teleport_")).length;
  await get("tp-player-form").dispatch("submit");
  get("confirm-dialog").returnValue = "cancel";
  await get("confirm-dialog").dispatch("close");
  assert.equal(calls.filter(({ command }) => command.startsWith("teleport_")).length, teleportCount);

  get("tp-coords-player").value = "Steve";
  get("tp-x").value = "12.5";
  get("tp-y").value = "64";
  get("tp-z").value = "-30";
  await get("tp-coords-form").dispatch("submit");
  get("confirm-dialog").returnValue = "confirm";
  await get("confirm-dialog").dispatch("close");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.some(({ command, args }) => command === "teleport_to_coords" && args.request.z === -30), true);

  online = false;
  tick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(get("status-pill").textContent, "正在重连");
  online = true;
  tick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(get("status-pill").textContent, "已连接");

  const history = JSON.parse(storage.get("pawkit.history.v1"));
  assert.equal(history.some(({ action, output }) => action.includes("广播") && output === "Broadcast sent"), true);
  assert.equal(history.some(({ action, output }) => action.includes("传送") && output === "Teleported"), true);
});
