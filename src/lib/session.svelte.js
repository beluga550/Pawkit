import { errorInfo } from "./api.js";

export const POLL_INTERVAL_MS = 15_000;
export const PROFILE_KEY = "pawkit.profile.v1";

// What to refresh after an action gets a server reply.
const AFTER_ACTION = {
  ban: ["bans", "players"],
  banIp: ["bans", "players"],
  pardon: ["bans"],
  pardonIp: ["bans"],
  kick: ["players"],
  whitelistAdd: ["whitelist"],
  whitelistRemove: ["whitelist"],
  whitelistSetEnabled: ["whitelist"],
};

export function createSession({ api, storage, history, toasts, timers = globalThis, now = () => new Date() }) {
  let status = $state("disconnected");
  let profile = $state(storage.read(PROFILE_KEY, null));
  let players = $state([]);
  let max = $state(null);
  let listOutput = $state("");
  let lastRefresh = $state(null);
  let pending = $state(null);
  let connecting = $state(false);
  let reconnectBusy = $state(false);
  let revisions = $state({ bans: 0, whitelist: 0 });

  // Bumped on connect/disconnect so late replies from an old session are ignored.
  let generation = 0;
  let refreshing = false;

  function resetServerState() {
    players = [];
    max = null;
    listOutput = "";
    lastRefresh = null;
  }

  function newGeneration() {
    generation += 1;
    refreshing = false;
  }

  function statusFor(info) {
    return info.kind === "unknown" ? "unknown" : "error";
  }

  async function refreshPlayers({ manual = false } = {}) {
    if (status === "disconnected" || refreshing) return;
    const current = generation;
    refreshing = true;
    try {
      const result = await api.query({ type: "onlinePlayers" });
      if (current !== generation) return;
      const recovered = status === "reconnecting";
      players = result.players;
      max = result.max;
      listOutput = result.output;
      lastRefresh = now();
      status = "connected";
      if (manual) history.record("刷新在线玩家", "returned", result.output);
      if (recovered) toasts.push({ tone: "info", title: "连接已恢复", detail: "在线玩家名单已更新" });
    } catch (error) {
      if (current !== generation) return;
      const info = errorInfo(error);
      status = "reconnecting";
      if (manual) {
        history.record("刷新在线玩家", statusFor(info), info.message);
        toasts.push({ tone: "error", title: "刷新失败", detail: info.message });
      }
    } finally {
      if (current === generation) refreshing = false;
    }
  }

  async function connect(nextProfile, password) {
    if (status !== "disconnected" || connecting) return { ok: false, skipped: true };
    connecting = true;
    try {
      await api.connect(nextProfile, password);
    } catch (error) {
      return { ok: false, error: errorInfo(error) };
    } finally {
      connecting = false;
    }
    newGeneration();
    resetServerState();
    profile = { name: nextProfile.name, host: nextProfile.host, port: nextProfile.port };
    storage.write(PROFILE_KEY, profile);
    status = "connected";
    history.record("连接服务器", "returned", "RCON 验证成功");
    await refreshPlayers();
    return { ok: true };
  }

  async function disconnect() {
    if (status === "disconnected") return;
    try {
      await api.disconnect();
    } catch (error) {
      toasts.push({ tone: "error", title: "断开失败", detail: errorInfo(error).message });
      return;
    }
    newGeneration();
    resetServerState();
    status = "disconnected";
    history.record("断开连接", "returned", "已主动断开，密码已从内存中清除");
  }

  async function reconnect() {
    if (status !== "reconnecting" || reconnectBusy) return;
    reconnectBusy = true;
    const current = generation;
    try {
      await api.reconnect();
      if (current !== generation) return;
      history.record("手动重连", "returned", "RCON 验证成功");
      await refreshPlayers();
    } catch (error) {
      if (current !== generation) return;
      const info = errorInfo(error);
      history.record("手动重连", "error", info.message);
      toasts.push({ tone: "error", title: "重连失败", detail: info.message });
    } finally {
      reconnectBusy = false;
    }
  }

  /** Runs one action exactly once. Confirmation happens before this is called. */
  async function run(action, label) {
    if (status !== "connected" || pending) return { ok: false, skipped: true };
    const current = generation;
    pending = action;
    try {
      const output = await api.perform(action);
      history.record(label, "returned", output);
      toasts.push({ tone: "ok", title: `服务器已回复 · ${label}`, detail: output || "（服务器没有返回文字）" });
      if (current === generation) {
        for (const area of AFTER_ACTION[action.type] ?? []) {
          if (area === "players") refreshPlayers();
          else revisions[area] += 1;
        }
      }
      return { ok: true, output };
    } catch (error) {
      const info = errorInfo(error);
      const unknown = info.kind === "unknown";
      history.record(label, statusFor(info), info.message);
      toasts.push({
        tone: unknown ? "unknown" : "error",
        title: `${unknown ? "结果未知" : "未执行"} · ${label}`,
        detail: unknown ? `${info.message}。不会自动重发。` : info.message,
      });
      if (current === generation && (unknown || info.kind === "disconnected")) status = "reconnecting";
      return { ok: false, error: info };
    } finally {
      pending = null;
    }
  }

  async function query(type, { manual = false, label = "" } = {}) {
    if (status === "disconnected") return null;
    const current = generation;
    try {
      const result = await api.query({ type });
      if (current !== generation) return null;
      if (manual) {
        const output = result.output ?? [result.playersOutput, result.ipsOutput].join("\n");
        history.record(label, "returned", output);
      }
      return result;
    } catch (error) {
      if (current !== generation) return null;
      const info = errorInfo(error);
      status = "reconnecting";
      if (manual) {
        history.record(label, statusFor(info), info.message);
        toasts.push({ tone: "error", title: "查询失败", detail: info.message });
      }
      return null;
    }
  }

  function start() {
    const timer = timers.setInterval(() => {
      history.prune();
      if (status !== "disconnected") refreshPlayers();
    }, POLL_INTERVAL_MS);
    return () => timers.clearInterval(timer);
  }

  return {
    get status() {
      return status;
    },
    get profile() {
      return profile;
    },
    get players() {
      return players;
    },
    get max() {
      return max;
    },
    get listOutput() {
      return listOutput;
    },
    get lastRefresh() {
      return lastRefresh;
    },
    get pending() {
      return pending;
    },
    get connecting() {
      return connecting;
    },
    get reconnectBusy() {
      return reconnectBusy;
    },
    get revisions() {
      return revisions;
    },
    start,
    connect,
    disconnect,
    reconnect,
    refreshPlayers,
    run,
    query,
    isOnline(name) {
      const wanted = String(name).toLowerCase();
      return players.some((player) => player.toLowerCase() === wanted);
    },
  };
}
