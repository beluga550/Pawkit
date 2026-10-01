import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
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
