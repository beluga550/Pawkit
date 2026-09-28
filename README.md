# Pawkit

Pawkit 是供单个 Minecraft 服主使用的 Windows 11 桌面工具。第一版通过 RCON 连接一台已有服务器，提供在线玩家查询、广播、玩家间传送和主世界坐标传送。界面使用原生 HTML、CSS、JavaScript，连接与命令执行由 Tauri/Rust 处理。

## 使用前准备

1. 在测试服启用 RCON，设置强密码和 RCON 端口。客户端必须通过可信局域网或加密隧道访问该端口，不应把 RCON 直接暴露到公网。
2. 在 Pawkit 中填写服务器名称、RCON 地址、端口和密码。游戏端口与 RCON 端口不同；RCON 默认端口通常为 `25575`，以实际配置为准。
3. 先在测试服执行 `list`，再由服主安排 `say` 和传送测试。玩家可以从名单选择，也可以手动输入 Java 版玩家名。

密码只保留在应用进程内，关闭应用或主动断开后即清除。名称、地址和端口保存在本机。操作记录只保留当前本地日期，台式机与笔记本不会同步。自动刷新每 15 秒检查一次连接和名单；断线后会自动尝试恢复，但不会重发广播或传送命令。若命令发出后未收到回复，会显示“结果未知”，请先在游戏中检查。

## 第一版范围

- `list`：显示服务端原始返回和识别出的在线玩家；可手动刷新。
- `say`：发送单行广播消息。
- `tp <玩家> <玩家>`：玩家间传送；执行前确认。
- `execute in minecraft:overworld run tp <玩家> <X> <Y> <Z>`：主世界绝对坐标传送；执行前确认。

Rust 后台仅提供上述明确操作，不提供任意命令执行入口。地图将在确定所用地图 Mod/插件的数据来源后作为独立功能加入。

## 开发与验证

需要 Rust 稳定版、Windows C++ Build Tools 和 WebView2。项目没有 npm 依赖；从仓库根目录运行：

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --locked
cargo install tauri-cli --version '^2' --locked
cargo tauri dev
cargo tauri build --bundles nsis
```

Windows 安装包位于 `src-tauri/target/release/bundle/nsis/`。Pull Request 也会运行 Windows 构建工作流并上传可下载的测试包。真正的服务器验收需要服主提供测试服，确认 Minecraft/服务端版本、RCON 配置和测试玩家；不要把 RCON 密码提交到仓库或写进 Issue。

验收内容：两台 Windows 11 电脑均可连接；`list` 返回玩家；`say` 在游戏内可见；两种传送结果正确；断线时有明确提示且不自动重发操作；重启应用后需要再次输入密码。
