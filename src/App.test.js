import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App.svelte";
import { PROFILE_KEY } from "./lib/session.svelte.js";
import { PREFS_KEY } from "./lib/prefs.svelte.js";
import { fakeApi, memoryBackend, settle, testApp } from "./test-utils.js";

const SAVED = { name: "生存一服", host: "192.168.1.10", port: 25575 };

function start({ api = fakeApi(), saved = SAVED } = {}) {
  const backend = memoryBackend(saved ? { [PROFILE_KEY]: JSON.stringify(saved) } : {});
  const app = testApp({ api, backend });
  render(App, { app });
  return { app, api, backend };
}

async function connect(password = "secret") {
  await fireEvent.input(screen.getByLabelText("RCON 密码"), { target: { value: password } });
  await fireEvent.click(screen.getByRole("button", { name: "连接服务器" }));
  await settle();
}

describe("connect page", () => {
  it("prefills the saved profile but never the password", () => {
    start();
    expect(screen.getByLabelText("服务器名称")).toHaveValue("生存一服");
    expect(screen.getByLabelText("RCON 地址")).toHaveValue("192.168.1.10");
    expect(screen.getByLabelText("RCON 端口")).toHaveValue(25575);
    expect(screen.getByLabelText("RCON 密码")).toHaveValue("");
  });

  it("shows field errors and does not call the backend for invalid input", async () => {
    const { api } = start({ saved: null });
    await fireEvent.click(screen.getByRole("button", { name: "连接服务器" }));
    expect(screen.getByText("请输入不超过 60 个字符的服务器名称")).toBeInTheDocument();
    expect(screen.getByText("请输入 RCON 密码")).toBeInTheDocument();
    expect(api.connect).not.toHaveBeenCalled();
  });

  it("shows the backend message when connecting fails and clears the password", async () => {
    const api = fakeApi();
    api.server.online = false;
    start({ api });
    await connect();
    expect(screen.getByText("RCON 连接中断")).toBeInTheDocument();
    expect(screen.getByLabelText("RCON 密码")).toHaveValue("");
  });
});

describe("shell", () => {
  it("opens the console after connecting and keeps the password out of storage", async () => {
    const { backend } = start();
    await connect();
    const sidebar = screen.getByRole("complementary", { name: "侧栏" });
    expect(within(sidebar).getByText("生存一服")).toBeInTheDocument();
    expect(within(sidebar).getByText(/已连接/)).toBeInTheDocument();
    expect([...backend.map.values()].some((value) => value.includes("secret"))).toBe(false);
  });

  it("navigates between pages", async () => {
    start();
    await connect();
    await fireEvent.click(screen.getByRole("button", { name: /封禁名单/ }));
    expect(screen.getByRole("heading", { level: 1, name: /封禁名单/ })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: /今日记录/ }));
    expect(screen.getByRole("heading", { level: 1, name: /今日记录/ })).toBeInTheDocument();
  });

  it("shows the reconnect banner and retries on request", async () => {
    const { app, api } = start();
    await connect();
    api.server.online = false;
    await app.session.refreshPlayers();
    await settle();
    expect(screen.getByRole("alert")).toHaveTextContent("连接中断");
    api.server.online = true;
    await fireEvent.click(screen.getByRole("button", { name: "立即重连" }));
    await settle();
    expect(api.reconnect).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("returns to the connect page after disconnecting", async () => {
    start();
    await connect();
    await fireEvent.click(screen.getByRole("button", { name: "断开连接" }));
    await settle();
    expect(screen.getByRole("button", { name: "连接服务器" })).toBeInTheDocument();
  });

  it("remembers the real-avatar switch", async () => {
    const { backend } = start();
    await connect();
    const toggle = screen.getByRole("switch", { name: "显示真实头像" });
    expect(toggle).toBeChecked();
    await fireEvent.click(toggle);
    expect(JSON.parse(backend.map.get(PREFS_KEY))).toEqual({ realAvatars: false });
  });

  it("lets the user close a toast", async () => {
    const { app } = start();
    app.toasts.push({ tone: "unknown", title: "结果未知 · 踢出 Steve", detail: "命令可能已经送达" });
    await settle();
    await fireEvent.click(screen.getByRole("button", { name: "关闭通知" }));
    expect(screen.queryByText("结果未知 · 踢出 Steve")).toBeNull();
  });
});

describe("end-to-end flow (migrated from tests/ui-smoke.mjs)", () => {
  afterEach(() => vi.useRealTimers());

  it("connects, broadcasts, teleports with cancel and confirm, and survives a dropped link", async () => {
    vi.useFakeTimers();
    const api = fakeApi();
    api.server.reply = (action) => (action.type === "broadcast" ? "Broadcast sent" : "Teleported");
    const { backend } = start({ api });
    await connect();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("2 / 20");

    // Broadcast: no confirmation.
    await fireEvent.input(screen.getByLabelText("广播内容"), { target: { value: "Hello players" } });
    await fireEvent.click(screen.getByRole("button", { name: "发送" }));
    await settle();
    expect(api.perform).toHaveBeenCalledWith({ type: "broadcast", message: "Hello players" });

    // Player-to-player teleport: cancel first, nothing is sent.
    await fireEvent.click(screen.getByRole("button", { name: /Steve/ }));
    await fireEvent.click(screen.getByRole("tab", { name: "到玩家" }));
    await fireEvent.change(screen.getByLabelText("目标玩家"), { target: { value: "Alex" } });
    await fireEvent.click(screen.getByRole("button", { name: "传送到 Alex" }));
    await fireEvent.click(screen.getByRole("button", { name: "取消" }), { detail: 1 });
    await settle();
    expect(api.perform).toHaveBeenCalledTimes(1);

    // ...then confirm.
    await fireEvent.click(screen.getByRole("button", { name: "传送到 Alex" }));
    await fireEvent.click(screen.getByRole("button", { name: "传送" }), { detail: 1 });
    await settle();
    expect(api.perform).toHaveBeenLastCalledWith({ type: "teleportToPlayer", player: "Steve", target: "Alex" });

    // Coordinate teleport, confirmed with Enter.
    await fireEvent.click(screen.getByRole("tab", { name: "到坐标" }));
    await fireEvent.input(screen.getByLabelText("X"), { target: { value: "12.5" } });
    await fireEvent.input(screen.getByLabelText("Y"), { target: { value: "64" } });
    await fireEvent.input(screen.getByLabelText("Z"), { target: { value: "-30" } });
    await fireEvent.click(screen.getByRole("button", { name: /传送到主世界/ }));
    await fireEvent.keyDown(document.querySelector("dialog"), { key: "Enter" });
    await settle();
    expect(api.perform).toHaveBeenLastCalledWith({
      type: "teleportToCoords",
      player: "Steve",
      dimension: "overworld",
      x: 12.5,
      y: 64,
      z: -30,
    });

    // The link drops: the next poll enters reconnecting and disables actions.
    api.server.online = false;
    await vi.advanceTimersByTimeAsync(15_000);
    expect(screen.getByRole("alert")).toHaveTextContent("连接中断");
    expect(screen.getByRole("button", { name: "发送" })).toBeDisabled();

    // It comes back on its own.
    api.server.online = true;
    await vi.advanceTimersByTimeAsync(15_000);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "发送" })).toBeEnabled();

    // Nothing was re-sent, history has the outputs, and the password never hit storage.
    expect(api.perform).toHaveBeenCalledTimes(3);
    const history = JSON.parse(backend.map.get("pawkit.history.v1"));
    expect(history.some(({ action, output }) => action.includes("广播") && output === "Broadcast sent")).toBe(true);
    expect(history.some(({ action, output }) => action.includes("传送") && output === "Teleported")).toBe(true);
    expect([...backend.map.values()].some((value) => value.includes("secret"))).toBe(false);
  });

  it("an unknown result stays on screen and is never retried", async () => {
    vi.useFakeTimers();
    const api = fakeApi();
    start({ api });
    await connect();
    api.server.failNext = { kind: "unknown", message: "命令可能已经送达，但没有收到完整回复" };
    await fireEvent.input(screen.getByLabelText("广播内容"), { target: { value: "hi" } });
    await fireEvent.click(screen.getByRole("button", { name: "发送" }));
    await settle();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(screen.getByText("结果未知 · 广播：hi")).toBeInTheDocument();
    expect(api.perform).toHaveBeenCalledTimes(1);
  });
});
