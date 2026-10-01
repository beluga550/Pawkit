# Pawkit

Pawkit 是供单个 Minecraft 服主使用的 Windows 11 桌面工具。它通过 RCON 连接一台已有服务器，以玩家为中心提供日常管理：查看在线玩家、广播、传送、游戏模式、踢出、封禁与解封、封禁 IP、白名单。界面用 Svelte 5 + Vite，连接与命令执行由 Tauri/Rust 处理。

## 使用前准备

1. 在服务器上启用 RCON，设置强密码和 RCON 端口。客户端必须通过可信局域网或加密隧道访问该端口，不要把 RCON 直接暴露到公网。
2. 在 Pawkit 中填写服务器名称、RCON 地址、端口和密码。游戏端口与 RCON 端口不同；RCON 默认端口通常为 `25575`，以实际配置为准。
3. 服务端需要 Java 版 1.13 及以上（三维度坐标传送用到 `execute in`）。

密码只保留在应用进程内，关闭应用或主动断开后即清除。名称、地址和端口保存在本机。操作记录只保留当天，跨过午夜自动清空；台式机与笔记本互不同步。在线玩家每 15 秒自动刷新一次，同时负责断线后的自动重连；断线时所有操作按钮置灰，但不会重发任何操作。命令发出后没收到完整回复时显示“结果未知”，请先到游戏里确认。

### 头像

玩家头像先显示本地生成的像素头，再从 `mc-heads.net` 加载真实皮肤，加载失败就一直用像素头。开启时玩家名会发送给 mc-heads.net。离线模式（非正版验证）服务器的玩家名对应不到正版皮肤，头像会显示错，可在侧栏服务器卡片上关闭“显示真实头像”，关闭后不再发出任何头像请求。

## 功能范围

| 操作 | 命令 | 确认 |
|---|---|---|
| 在线玩家 | `list` | 不确认 |
| 广播 | `say <消息>` | 不确认 |
| 传送到玩家 | `tp <玩家> <玩家>` | 普通确认 |
| 传送到坐标 | `execute in minecraft:<overworld/the_nether/the_end> run tp <玩家> <X> <Y> <Z>` | 普通确认 |
| 游戏模式 | `gamemode <survival/creative/adventure/spectator> <玩家>` | 普通确认 |
| 踢出 | `kick <玩家> [原因]` | 普通确认 |
| 封禁 / 解封 | `ban <玩家> [原因]` / `pardon <玩家>` | 危险确认 / 普通确认 |
| 封禁 IP / 解封 IP | `ban-ip <IP 或玩家> [原因]` / `pardon-ip <IP>` | 危险确认 / 普通确认 |
| 封禁名单 | `banlist players`、`banlist ips` | 不确认 |
| 白名单 | `whitelist list`、`whitelist add/remove <玩家>` | 不确认 / 普通确认 |
| 白名单开关 | `whitelist on` / `whitelist off` | 危险确认 |

危险确认的弹窗是红色的，默认焦点在“取消”，按回车等于取消，必须用鼠标点击确认按钮。Rust 后台只接受上述固定操作，不提供任意命令入口。地图将在确定地图插件后作为独立功能加入。

## 开发与验证

需要 Node.js 24、Rust 稳定版、Windows C++ Build Tools 和 WebView2。从仓库根目录运行：

```powershell
npm ci
npm test                 # Vitest：前端逻辑、组件、端到端流程
npm run build            # 生成 dist/，Rust 编译需要它
cargo test --manifest-path src-tauri/Cargo.toml --locked
cargo install tauri-cli --version '^2' --locked
cargo tauri dev
cargo tauri build --bundles nsis
```

不连真实服务器也能在浏览器里预览界面：`npm run dev:mock` 打开 `http://localhost:1420`，后端换成内置的假服务器（密码填 `wrong` 可模拟连接失败，广播内容填 `unknown` 可模拟“结果未知”）。`npm run build:mock` + `npm run preview:mock` 会在 `http://localhost:4173` 用和安装包相同的 CSP 提供页面，用于检查 CSP。

Windows 安装包位于 `src-tauri/target/release/bundle/nsis/`。Pull Request 也会运行 Windows 构建工作流并上传可下载的测试包。不要把 RCON 密码提交到仓库或写进 Issue。

## 验收

第一版验收项继续有效：两台 Windows 11 电脑均可连接；`list` 返回玩家；`say` 在游戏内可见；传送结果正确；断线时有明确提示且不自动重发操作；重启应用后需要再次输入密码。第二版新增：

1. 踢出（有原因 / 无原因）在游戏内生效，原因显示给玩家。
2. 封禁、解封在线与离线玩家；封禁名单能显示，解析失败时能手动解封。
3. 封禁 IP、解封 IP。
4. 白名单增删、开启、关闭，名单能显示。
5. 四种游戏模式切换正确。
6. 主世界、下界、末地坐标传送正确。
7. 危险操作必须点击确认；回车不会误触发。
8. 真实头像能加载；断网或关闭开关时显示生成头像。
9. 窗口缩窄到 960 宽时抽屉改为覆盖式，仍可正常操作。

验收时记录服务端软件与版本、是否装有 EssentialsX 等会接管 `ban`/`kick` 的插件，以及 `banlist` 的原始输出是否带换行。
