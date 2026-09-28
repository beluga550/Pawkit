const invoke = window.__TAURI__?.core?.invoke;
const PROFILE_KEY = "pawkit.profile.v1";
const HISTORY_KEY = "pawkit.history.v1";
const POLL_INTERVAL_MS = 15_000;

const byId = (id) => document.getElementById(id);
const state = { hasSession: false, sessionId: 0, status: "disconnected", busy: false, refreshing: false, players: [], history: [] };

function localDate(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function readStored(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function writeStored(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { showNotice("这台电脑无法保存本地记录，请检查应用存储空间。", true); }
}

function cleanHistory() {
  const today = localDate();
  state.history = state.history.filter((entry) => entry.date === today);
  writeStored(HISTORY_KEY, state.history);
  renderHistory();
}

function showNotice(message, isError = false) {
  byId("notice").textContent = message;
  byId("notice").classList.toggle("error", isError);
}

function errorInfo(error) {
  if (error && typeof error === "object" && typeof error.message === "string") return error;
  return { kind: "internal", message: String(error ?? "未知错误") };
}

function renderStatus() {
  const statusNames = { connected: "已连接", reconnecting: "正在重连", disconnected: "未连接" };
  const status = state.status;
  const label = statusNames[status];
  byId("status-pill").textContent = label;
  byId("status-pill").className = `status-pill ${status}`;
  byId("sidebar-dot").className = `dot ${status}`;
  byId("sidebar-status").textContent = label;
  byId("connect-button").disabled = state.hasSession || state.busy;
  byId("reconnect-button").disabled = !state.hasSession || state.busy || state.refreshing;
  byId("disconnect-button").disabled = !state.hasSession || state.busy;
  byId("refresh-button").disabled = !state.hasSession || state.busy || state.refreshing;
  document.querySelectorAll("[data-requires-connection]").forEach((button) => {
    button.disabled = status !== "connected" || state.busy;
  });
  for (const id of ["server-name", "server-host", "server-port", "server-password"]) {
    byId(id).disabled = state.hasSession || state.busy;
  }
}

function renderPlayers() {
  const container = byId("players");
  const list = byId("online-players");
  container.replaceChildren();
  list.replaceChildren();
  byId("player-count").textContent = state.status === "connected" ? String(state.players.length) : "—";
  if (state.status !== "connected") {
    const empty = document.createElement("span");
    empty.className = "empty-state";
    empty.textContent = "连接后显示在线玩家";
    container.append(empty);
    return;
  }
  if (!state.players.length) {
    const empty = document.createElement("span");
    empty.className = "empty-state";
    empty.textContent = "没有识别出在线玩家；仍可手动输入玩家名。";
    container.append(empty);
    return;
  }
  for (const player of state.players) {
    const chip = document.createElement("span");
    chip.className = "player-chip";
    chip.textContent = player;
    container.append(chip);
    const option = document.createElement("option");
    option.value = player;
    list.append(option);
  }
}

function renderHistory() {
  const container = byId("history");
  container.replaceChildren();
  if (!state.history.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "今天还没有操作记录。";
    container.append(empty);
    return;
  }
  for (const entry of [...state.history].reverse()) {
    const row = document.createElement("div");
    row.className = "history-entry";
    const time = document.createElement("span");
    time.className = "time";
    time.textContent = new Date(entry.at).toLocaleTimeString("zh-CN", { hour12: false });
    const content = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = entry.action;
    const status = document.createElement("span");
    status.className = `status ${entry.status}`;
    status.textContent = { returned: "服务器已回复", unknown: "结果未知", error: "未执行" }[entry.status] ?? entry.status;
    const output = document.createElement("pre");
    output.textContent = entry.output || "（服务器没有返回文字）";
    content.append(title, status, output);
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "copy-button";
    copy.textContent = "复制";
    copy.addEventListener("click", async () => {
      const text = `${time.textContent} ${entry.action}\n${entry.output}`;
      try { await copyText(text); showNotice("已复制这条记录。"); }
      catch { showNotice("复制失败，请手动选择记录文字。", true); }
    });
    row.append(time, content, copy);
    container.append(row);
  }
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const field = document.createElement("textarea");
  field.value = text;
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  if (!copied) throw new Error("copy failed");
}

function record(action, status, output) {
  const now = new Date();
  state.history.push({ date: localDate(now), at: now.toISOString(), action, status, output });
  cleanHistory();
}

function profileFromForm() {
  return {
    name: byId("server-name").value.trim(),
    host: byId("server-host").value.trim(),
    port: Number(byId("server-port").value),
  };
}

function setConnectionState(status) {
  state.status = status;
  if (status !== "connected") state.players = [];
  renderStatus();
  renderPlayers();
}

async function refreshPlayers(manual = false) {
  if (!state.hasSession || state.refreshing || state.busy) return;
  const sessionId = state.sessionId;
  state.refreshing = true;
  renderStatus();
  try {
    const response = await invoke("list_players");
    if (!state.hasSession || state.sessionId !== sessionId) return;
    const recovered = state.status !== "connected";
    state.players = response.players;
    setConnectionState("connected");
    byId("last-refresh").textContent = `最近刷新：${new Date().toLocaleTimeString("zh-CN", { hour12: false })}`;
    byId("players-hint").textContent = response.output || "服务器没有返回玩家名单，可手动输入玩家名。";
    if (manual) record("查询在线玩家", "returned", response.output);
    if (recovered) showNotice("连接已恢复，在线玩家名单已更新。");
  } catch (error) {
    if (!state.hasSession || state.sessionId !== sessionId) return;
    const info = errorInfo(error);
    setConnectionState("reconnecting");
    byId("last-refresh").textContent = "连接中断；稍后自动重试";
    if (manual) record("查询在线玩家", info.kind === "unknown" ? "unknown" : "error", info.message);
    showNotice(`${info.message}；下一次自动刷新会尝试重连。`, true);
  } finally {
    state.refreshing = false;
    renderStatus();
  }
}

async function connect(event) {
  event.preventDefault();
  if (!invoke || state.hasSession) return;
  const profile = profileFromForm();
  const password = byId("server-password").value;
  state.busy = true;
  renderStatus();
  try {
    await invoke("connect_rcon", { profile, password });
    state.hasSession = true;
    state.sessionId += 1;
    writeStored(PROFILE_KEY, profile);
    byId("server-subtitle").textContent = `${profile.name} · ${profile.host}:${profile.port}`;
    setConnectionState("connected");
    showNotice("RCON 验证成功，正在获取玩家名单。 ");
    record("连接服务器", "returned", "RCON 验证成功");
  } catch (error) {
    showNotice(errorInfo(error).message, true);
  } finally {
    byId("server-password").value = "";
    state.busy = false;
    renderStatus();
  }
  if (state.hasSession) await refreshPlayers();
}

async function reconnect() {
  if (!state.hasSession || state.busy) return;
  state.busy = true;
  renderStatus();
  try {
    await invoke("reconnect_rcon");
    setConnectionState("connected");
    showNotice("RCON 已重新连接，正在刷新玩家名单。");
    record("手动重连", "returned", "RCON 验证成功");
  } catch (error) {
    const info = errorInfo(error);
    setConnectionState("reconnecting");
    record("手动重连", "error", info.message);
    showNotice(info.message, true);
  } finally {
    state.busy = false;
    renderStatus();
  }
  if (state.status === "connected") await refreshPlayers();
}

async function disconnect() {
  if (!state.hasSession || state.busy) return;
  try { await invoke("disconnect_rcon"); }
  catch (error) { showNotice(errorInfo(error).message, true); return; }
  state.hasSession = false;
  state.sessionId += 1;
  setConnectionState("disconnected");
  byId("server-subtitle").textContent = "连接后即可查看玩家并使用快捷操作。";
  byId("last-refresh").textContent = "尚未刷新";
  byId("players-hint").textContent = "连接后显示玩家名单；每 15 秒自动刷新。";
  showNotice("已断开；RCON 密码已从本次连接状态中清除。");
  record("断开连接", "returned", "已主动断开");
}

async function runAction(command, args, action) {
  if (state.status !== "connected" || state.busy) return;
  state.busy = true;
  renderStatus();
  try {
    const output = await invoke(command, args);
    record(action, "returned", output);
    showNotice("服务器已返回结果，请查看今日记录确认操作内容。");
  } catch (error) {
    const info = errorInfo(error);
    record(action, info.kind === "unknown" ? "unknown" : "error", info.message);
    showNotice(info.message, true);
    if (info.kind === "unknown" || info.kind === "disconnected") setConnectionState("reconnecting");
  } finally {
    state.busy = false;
    renderStatus();
  }
}

function validPlayer(name) { return /^[A-Za-z0-9_]{3,16}$/.test(name); }

function checkPlayer(name) {
  if (validPlayer(name)) return true;
  showNotice("玩家名需要是 3–16 位英文字母、数字或下划线，不能使用 @a 等选择器。", true);
  return false;
}

function confirmTeleport(summary, action) {
  byId("confirm-summary").textContent = summary;
  const dialog = byId("confirm-dialog");
  dialog.returnValue = "cancel";
  dialog.addEventListener("close", () => { if (dialog.returnValue === "confirm") action(); }, { once: true });
  dialog.showModal();
}

function onSay(event) {
  event.preventDefault();
  const message = byId("say-message").value.trim();
  if (!message || /[\r\n\0]/.test(message)) { showNotice("广播只能是一行普通文字。", true); return; }
  runAction("broadcast", { message }, `广播：${message}`);
}

function onTeleportPlayer(event) {
  event.preventDefault();
  const source = byId("tp-player-source").value.trim();
  const destination = byId("tp-player-destination").value.trim();
  if (!checkPlayer(source) || !checkPlayer(destination)) return;
  if (source === destination) { showNotice("起点和目的地不能是同一玩家。", true); return; }
  confirmTeleport(`将 ${source} 传送到 ${destination} 的位置。`, () => {
    runAction("teleport_to_player", { request: { source, destination } }, `传送：${source} → ${destination}`);
  });
}

function onTeleportCoords(event) {
  event.preventDefault();
  const player = byId("tp-coords-player").value.trim();
  if (!checkPlayer(player)) return;
  const [x, y, z] = ["tp-x", "tp-y", "tp-z"].map((id) => Number(byId(id).value));
  if ([x, y, z].some((value) => !Number.isFinite(value) || Math.abs(value) > 29_999_984)) {
    showNotice("请输入世界边界内的有效绝对坐标。", true); return;
  }
  confirmTeleport(`将 ${player} 传送到主世界坐标 X ${x} / Y ${y} / Z ${z}。`, () => {
    runAction("teleport_to_coords", { request: { player, x, y, z } }, `传送：${player} → 主世界 (${x}, ${y}, ${z})`);
  });
}

window.addEventListener("DOMContentLoaded", () => {
  const profile = readStored(PROFILE_KEY, {});
  byId("server-name").value = profile.name ?? "";
  byId("server-host").value = profile.host ?? "";
  byId("server-port").value = profile.port ?? 25575;
  state.history = readStored(HISTORY_KEY, []);
  if (!Array.isArray(state.history)) state.history = [];
  cleanHistory();
  renderStatus();
  renderPlayers();
  byId("connection-form").addEventListener("submit", connect);
  byId("reconnect-button").addEventListener("click", reconnect);
  byId("disconnect-button").addEventListener("click", disconnect);
  byId("refresh-button").addEventListener("click", () => refreshPlayers(true));
  byId("say-form").addEventListener("submit", onSay);
  byId("tp-player-form").addEventListener("submit", onTeleportPlayer);
  byId("tp-coords-form").addEventListener("submit", onTeleportCoords);
  setInterval(() => { cleanHistory(); if (state.hasSession) refreshPlayers(); }, POLL_INTERVAL_MS);
  if (!invoke) showNotice("请在 Pawkit 桌面应用中打开此页面。", true);
});
