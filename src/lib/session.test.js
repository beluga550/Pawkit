import { afterEach, describe, expect, it, vi } from "vitest";
import { createHistory } from "./history.svelte.js";
import { createSession, POLL_INTERVAL_MS, PROFILE_KEY } from "./session.svelte.js";
import { createStorage } from "./storage.js";
import { createToasts } from "./toasts.svelte.js";
import { deferred, fakeApi, memoryBackend, settle } from "../test-utils.js";

const PROFILE = { name: "生存一服", host: "192.168.1.10", port: 25575 };

function setup({ now } = {}) {
  const api = fakeApi();
  const backend = memoryBackend();
  const storage = createStorage(backend);
  const clock = { now: now ?? new Date(2026, 9, 1, 19, 0) };
  const history = createHistory({ storage, now: () => clock.now });
  const toasts = createToasts();
  const session = createSession({ api, storage, history, toasts, now: () => clock.now });
  return { api, backend, clock, history, toasts, session };
}

afterEach(() => vi.useRealTimers());

describe("connect", () => {
  it("connects, saves the profile without the password and loads players", async () => {
    const { api, backend, history, session } = setup();
    const result = await session.connect(PROFILE, "secret");
    expect(result.ok).toBe(true);
    expect(api.connect).toHaveBeenCalledWith(PROFILE, "secret");
    expect(session.status).toBe("connected");
    expect(session.players).toEqual(["Steve", "Alex"]);
    expect(session.max).toBe(20);
    expect(JSON.parse(backend.map.get(PROFILE_KEY))).toEqual(PROFILE);
    expect([...backend.map.values()].some((value) => value.includes("secret"))).toBe(false);
    expect(history.entries.map((entry) => entry.action)).toEqual(["连接服务器"]);
  });

  it("stays disconnected and returns the error when connecting fails", async () => {
    const { api, backend, session } = setup();
    api.server.online = false;
    const result = await session.connect(PROFILE, "secret");
    expect(result).toEqual({ ok: false, error: { kind: "disconnected", message: "RCON 连接中断" } });
    expect(session.status).toBe("disconnected");
    expect(backend.map.has(PROFILE_KEY)).toBe(false);
  });
});

describe("polling", () => {
  it("refreshes every 15 seconds, enters reconnecting when offline and recovers", async () => {
    vi.useFakeTimers();
    const { api, toasts, session } = setup();
    const stop = session.start();
    await session.connect(PROFILE, "secret");
    api.server.players = ["Steve"];
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(session.players).toEqual(["Steve"]);

    api.server.online = false;
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(session.status).toBe("reconnecting");

    api.server.online = true;
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(session.status).toBe("connected");
    expect(toasts.items.some((toast) => toast.title === "连接已恢复")).toBe(true);
    stop();
  });

  it("poll tick prunes history after midnight", async () => {
    vi.useFakeTimers();
    const { clock, history, session } = setup({ now: new Date(2026, 9, 1, 23, 59, 50) });
    session.start();
    await session.connect(PROFILE, "secret");
    expect(history.entries).toHaveLength(1);
    clock.now = new Date(2026, 9, 2, 0, 0, 5);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(history.entries).toEqual([]);
  });

  it("records manual refreshes but not automatic ones", async () => {
    vi.useFakeTimers();
    const { history, session } = setup();
    session.start();
    await session.connect(PROFILE, "secret");
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await session.refreshPlayers({ manual: true });
    expect(history.entries.map((entry) => entry.action)).toEqual(["连接服务器", "刷新在线玩家"]);
  });
});

describe("stale results", () => {
  it("drops results that arrive after disconnect", async () => {
    const { api, session } = setup();
    await session.connect(PROFILE, "secret");
    const slow = deferred();
    api.query.mockImplementationOnce(() => slow.promise);
    const refresh = session.refreshPlayers();
    await session.disconnect();
    slow.resolve({ output: "late", players: ["Late_Player"], max: 99 });
    await refresh;
    expect(session.status).toBe("disconnected");
    expect(session.players).toEqual([]);
  });

  it("does not let a late failure from an old session mark the new one as reconnecting", async () => {
    const { api, session } = setup();
    await session.connect(PROFILE, "secret");
    const slow = deferred();
    api.query.mockImplementationOnce(() => slow.promise);
    const refresh = session.refreshPlayers();
    await session.disconnect();
    await session.connect(PROFILE, "secret");
    slow.reject({ kind: "disconnected", message: "old" });
    await refresh;
    expect(session.status).toBe("connected");
  });
});

describe("actions", () => {
  it("records the server reply and shows a short-lived toast", async () => {
    const { api, history, toasts, session } = setup();
    await session.connect(PROFILE, "secret");
    const result = await session.run({ type: "broadcast", message: "hi" }, "广播：hi");
    expect(result).toEqual({ ok: true, output: "ok broadcast" });
    expect(api.perform).toHaveBeenCalledWith({ type: "broadcast", message: "hi" });
    expect(history.entries.at(-1)).toMatchObject({ action: "广播：hi", status: "returned", output: "ok broadcast" });
    expect(toasts.items.at(-1).tone).toBe("ok");
  });

  it("ignores a second action while one is running", async () => {
    const { api, session } = setup();
    await session.connect(PROFILE, "secret");
    const slow = deferred();
    api.perform.mockImplementationOnce(() => slow.promise);
    const first = session.run({ type: "kick", player: "Steve", reason: null }, "踢出 Steve");
    expect(session.pending.type).toBe("kick");
    const second = await session.run({ type: "kick", player: "Steve", reason: null }, "踢出 Steve");
    expect(second.skipped).toBe(true);
    slow.resolve("Kicked Steve");
    await first;
    expect(api.perform).toHaveBeenCalledTimes(1);
    expect(session.pending).toBeNull();
  });

  it("marks an unknown result, keeps its toast and enters reconnecting without retrying", async () => {
    const { api, history, toasts, session } = setup();
    await session.connect(PROFILE, "secret");
    api.server.failNext = { kind: "unknown", message: "命令可能已经送达" };
    const result = await session.run({ type: "ban", player: "Griefer99", reason: null }, "封禁 Griefer99");
    expect(result.ok).toBe(false);
    expect(api.perform).toHaveBeenCalledTimes(1);
    expect(session.status).toBe("reconnecting");
    expect(history.entries.at(-1)).toMatchObject({ status: "unknown", output: "命令可能已经送达" });
    expect(toasts.items.at(-1).tone).toBe("unknown");
  });

  it("records a disconnected failure as not executed", async () => {
    const { api, history, session } = setup();
    await session.connect(PROFILE, "secret");
    api.server.online = false;
    await session.run({ type: "kick", player: "Steve", reason: null }, "踢出 Steve");
    expect(history.entries.at(-1).status).toBe("error");
    expect(session.status).toBe("reconnecting");
  });

  it("refuses to run while reconnecting", async () => {
    const { api, session } = setup();
    await session.connect(PROFILE, "secret");
    api.server.online = false;
    await session.refreshPlayers();
    api.server.online = true;
    const result = await session.run({ type: "kick", player: "Steve", reason: null }, "踢出 Steve");
    expect(result.skipped).toBe(true);
    expect(api.perform).not.toHaveBeenCalled();
  });

  it("bumps list revisions and refreshes players after related actions", async () => {
    const { api, session } = setup();
    await session.connect(PROFILE, "secret");
    await session.run({ type: "ban", player: "Alex", reason: null }, "封禁 Alex");
    expect(session.revisions.bans).toBe(1);
    await session.run({ type: "whitelistAdd", player: "Alex" }, "加入白名单：Alex");
    expect(session.revisions.whitelist).toBe(1);
    await settle();
    const queriesBefore = api.query.mock.calls.length;
    await session.run({ type: "kick", player: "Steve", reason: null }, "踢出 Steve");
    await settle();
    expect(api.query.mock.calls.length).toBe(queriesBefore + 1);
  });
});

describe("queries and helpers", () => {
  it("loads ban lists and records only manual queries", async () => {
    const { history, session } = setup();
    await session.connect(PROFILE, "secret");
    expect((await session.query("bans")).players).toEqual([]);
    await session.query("whitelist", { manual: true, label: "刷新白名单" });
    expect(history.entries.map((entry) => entry.action)).toEqual(["连接服务器", "刷新白名单"]);
  });

  it("isOnline ignores case", async () => {
    const { session } = setup();
    await session.connect(PROFILE, "secret");
    expect(session.isOnline("steve")).toBe(true);
    expect(session.isOnline("Notch")).toBe(false);
  });

  it("disconnect clears the session but keeps the profile for next time", async () => {
    const { history, session } = setup();
    await session.connect(PROFILE, "secret");
    await session.disconnect();
    expect(session.status).toBe("disconnected");
    expect(session.players).toEqual([]);
    expect(session.profile).toEqual(PROFILE);
    expect(history.entries.at(-1).action).toBe("断开连接");
  });

  it("manual reconnect refreshes players on success", async () => {
    const { api, session } = setup();
    await session.connect(PROFILE, "secret");
    api.server.online = false;
    await session.refreshPlayers();
    api.server.online = true;
    await session.reconnect();
    expect(api.reconnect).toHaveBeenCalledOnce();
    expect(session.status).toBe("connected");
  });
});

describe("not sent", () => {
  it("records and announces a confirmed action that was never sent", async () => {
    const { history, toasts, session } = setup();
    await session.connect(PROFILE, "secret");
    session.notSent("封禁 Steve");
    expect(history.entries.at(-1)).toMatchObject({ action: "封禁 Steve", status: "error" });
    expect(toasts.items.at(-1)).toMatchObject({ tone: "error", title: "未执行 · 封禁 Steve" });
  });
});
