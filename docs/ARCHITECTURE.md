# 架构

Pawkit 是单机、单服主使用的 Windows 应用。前端（Svelte 5 + Vite）负责输入、校验、确认、状态显示与本地记录；Rust 后端（Tauri 2）负责连接 RCON、再次校验参数、构造固定命令并返回服务端原文。前端无法提交任意 RCON 命令。设计文档见 `docs/superpowers/specs/2026-09-29-console-v2-design.md`。

## 后端（`src-tauri/src/`）

- `action.rs`：唯一的命令入口是两个带标签的枚举。`Query`（`onlinePlayers`、`bans`、`whitelist`）只读，可以自动刷新和重试；`Action`（广播、两种传送、游戏模式、踢出、封禁、封禁 IP、解封、白名单）会改变服务器状态，只执行一次，不重试。反序列化失败或校验失败都直接拒绝。
- `parse.rs`：解析 `list`、`whitelist list`、`banlist`。`banlist` 的条目数与 “There are N ban(s)” 对不上（例如 RCON 回复丢了换行）时返回 `null`，界面改为显示原文和手动解封框，不会给出错误的解封按钮。
- `rcon.rs`：凭据只保存在进程内存。每次调用开一个短连接，避免断线后复用坏连接；`bans` 查询在同一连接里连发两条命令。连接或认证失败为 `disconnected`（命令肯定没发出）；命令发出后超时或回复不完整为 `unknown`。
- `commands.rs`：五个 Tauri 命令 `connect_rcon`、`reconnect_rcon`、`disconnect_rcon`、`query`、`perform`。

## 前端（`src/`）

- `lib/api.js` 是唯一的后端入口；测试和浏览器预览（`--mode mock`）换成假实现。
- `lib/session.svelte.js` 是连接状态机：已连接 / 正在重连 / 未连接。每 15 秒的在线玩家查询同时承担自动重连；每次连接或断开都会换一代，丢弃上一代迟到的结果。同一时间只执行一个操作。
- `lib/operations.js` 给每种操作定记录文案和确认级别；界面上所有改动服务器的按钮都经过 `executeOperation`：先确认，再执行一次。
- `lib/validate.js` 与 `action.rs` 用同一份 `tests/fixtures/validation.json` 测试，规则不一致时两边的测试都会失败。
- 名称、地址、端口、今日记录和“显示真实头像”偏好存在 localStorage；密码从不写入。

## 安全

正式版 CSP：`default-src 'self'; img-src 'self' https://mc-heads.net; connect-src ipc: http://ipc.localhost`。Svelte 模板里写死的 `style="..."` 属性会被这条 CSP 拦截，所以组件只用 class 和 `style:` 指令；`src/source-rules.test.js` 强制检查这一点，并禁止 `{@html}`。开发模式用 `devCsp` 额外放开 Vite 需要的内联样式和热更新 WebSocket。

## 地图

地图下一版接入 `src-tauri/src/map.rs`，届时再根据实际插件确定数据格式和更新方式。地图数据入口与 RCON 命令入口分开，避免地图需求改变控制操作的接口。
