export const DIMENSION_LABELS = { overworld: "主世界", nether: "下界", end: "末地" };
export const MODE_LABELS = { survival: "生存", creative: "创造", adventure: "冒险", spectator: "旁观" };

const withReason = (text, reason) => (reason ? `${text} · 原因：${reason}` : text);
const reasonDetail = (reason) => (reason ? `原因：${reason}（会显示给该玩家）` : "未填写原因");

const normal = (title, summary, confirmLabel, extra = {}) => ({ level: "normal", title, summary, confirmLabel, ...extra });
const danger = (title, summary, consequence, confirmLabel, extra = {}) => ({
  level: "danger",
  title,
  summary,
  consequence,
  confirmLabel,
  ...extra,
});

/** History label and confirmation for each fixed action (spec 6.6). */
export function describe(action) {
  switch (action.type) {
    case "broadcast":
      return { label: `广播：${action.message}`, confirm: null };
    case "teleportToPlayer":
      return {
        label: `传送：${action.player} → ${action.target}`,
        confirm: normal("确认传送", `将 ${action.player} 传送到 ${action.target} 的位置。`, "传送"),
      };
    case "teleportToCoords": {
      const where = `${DIMENSION_LABELS[action.dimension]} (${action.x}, ${action.y}, ${action.z})`;
      return {
        label: `传送：${action.player} → ${where}`,
        confirm: normal("确认传送", `将 ${action.player} 传送到${where}。`, "传送"),
      };
    }
    case "setGameMode":
      return {
        label: `游戏模式：${action.player} → ${MODE_LABELS[action.mode]}`,
        confirm: normal("确认更改游戏模式", `将 ${action.player} 的游戏模式改为${MODE_LABELS[action.mode]}。`, "更改"),
      };
    case "kick":
      return {
        label: withReason(`踢出 ${action.player}`, action.reason),
        confirm: normal("确认踢出", `将 ${action.player} 踢出服务器。`, "踢出", { detail: reasonDetail(action.reason) }),
      };
    case "ban":
      return {
        label: withReason(`封禁 ${action.player}`, action.reason),
        confirm: danger("确认封禁", `封禁 ${action.player}。`, `${action.player} 将无法再进入服务器，直到被解封。`, "封禁", {
          detail: reasonDetail(action.reason),
        }),
      };
    case "banIp":
      return {
        label: withReason(`封禁 IP：${action.target}`, action.reason),
        confirm: danger("确认封禁 IP", `封禁 ${action.target} 的 IP 地址。`, "同一网络（IP）下的所有人都将无法进入服务器。", "封禁 IP", {
          detail: reasonDetail(action.reason),
        }),
      };
    case "pardon":
      return {
        label: `解封 ${action.player}`,
        confirm: normal("确认解封", `解除对 ${action.player} 的封禁。`, "解封"),
      };
    case "pardonIp":
      return {
        label: `解封 IP：${action.ip}`,
        confirm: normal("确认解封 IP", `解除对 ${action.ip} 的 IP 封禁。`, "解封"),
      };
    case "whitelistAdd":
      return {
        label: `加入白名单：${action.player}`,
        confirm: normal("确认加入白名单", `将 ${action.player} 加入白名单。`, "加入"),
      };
    case "whitelistRemove":
      return {
        label: `移出白名单：${action.player}`,
        confirm: normal("确认移出白名单", `将 ${action.player} 移出白名单。`, "移出"),
      };
    case "whitelistSetEnabled":
      return action.enabled
        ? {
            label: "开启白名单",
            confirm: danger("确认开启白名单", "开启白名单。", "不在白名单上的玩家将无法进入服务器。", "开启"),
          }
        : {
            label: "关闭白名单",
            confirm: danger("确认关闭白名单", "关闭白名单。", "任何知道服务器地址的人都可以进入。", "关闭"),
          };
    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

/** The only way UI buttons change server state: confirm first, then run once. */
export async function executeOperation({ session, confirmer }, action) {
  if (session.status !== "connected" || session.pending) return { ok: false, skipped: true };
  const { label, confirm } = describe(action);
  if (confirm && !(await confirmer.ask(confirm))) return { ok: false, cancelled: true };
  const result = await session.run(action, label);
  // The state may have changed while the dialog was open; never drop a confirmed action silently.
  if (confirm && result.skipped) session.notSent(label);
  return result;
}
