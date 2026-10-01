// Same rules as src-tauri/src/action.rs. tests/fixtures/validation.json keeps them in sync.
export const MAX_COORDINATE = 29_999_984;
export const MESSAGE_MAX = 256;
export const REASON_MAX = 100;
const SERVER_NAME_MAX = 60;

const PLAYER = /^[A-Za-z0-9_]{3,16}$/;
const CONTROL = /\p{Cc}/u;
const OCTET = "(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4 = new RegExp(`^${OCTET}(\\.${OCTET}){3}$`);

const ok = (value) => ({ ok: true, value });
const fail = (error) => ({ ok: false, error });

/** Length in Unicode code points, matching Rust's `chars().count()`. */
export function charCount(text) {
  return [...text].length;
}

export function isPlayerName(value) {
  return typeof value === "string" && PLAYER.test(value);
}

function isIpv6(value) {
  if (!value.includes(":") || /[\s%/[\]]/.test(value)) return false;
  try {
    new URL(`http://[${value}]/`);
    return true;
  } catch {
    return false;
  }
}

export function isIp(value) {
  return typeof value === "string" && (IPV4.test(value) || isIpv6(value));
}

export function checkPlayer(value) {
  return isPlayerName(value) ? ok(value) : fail("玩家名只能包含 3–16 位英文字母、数字或下划线，不能使用 @a 等选择器");
}

export function checkMessage(value) {
  const text = String(value ?? "").trim();
  if (!text || charCount(text) > MESSAGE_MAX || CONTROL.test(text)) {
    return fail("广播内容必须是 1–256 个字符的单行文字");
  }
  return ok(text);
}

export function checkReason(value) {
  const text = String(value ?? "").trim();
  if (!text) return ok(null);
  if (charCount(text) > REASON_MAX || CONTROL.test(text)) {
    return fail("原因最多 100 个字符，且只能是一行文字");
  }
  return ok(text);
}

export function checkIp(value) {
  return isIp(value) ? ok(value) : fail("请输入有效的 IP 地址，例如 203.0.113.7");
}

export function checkBanIpTarget(value) {
  return isIp(value) || isPlayerName(value) ? ok(value) : fail("请输入有效的 IP 地址或玩家名");
}

export function checkCoordinate(value) {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= MAX_COORDINATE
    ? ok(value)
    : fail("请输入世界边界内的坐标（±29,999,984）");
}

export function checkServerName(value) {
  const text = String(value ?? "").trim();
  if (!text || charCount(text) > SERVER_NAME_MAX) return fail("请输入不超过 60 个字符的服务器名称");
  return ok(text);
}
