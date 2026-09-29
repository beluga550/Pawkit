# Pawkit 控制台 v2 设计：界面重做 + 扩展控制

- 日期：2026-09-29
- 状态：设计已逐段确认，待审阅书面稿
- 范围：子项目 1（界面重做 + 扩展控制）。地图是子项目 2，单独设计，见第 13 节。
- 视觉参考：[assets/2026-09-29-console-v2-mockup.html](assets/2026-09-29-console-v2-mockup.html)（已确认的高保真示意，用浏览器打开）

## 1. 背景与目标

第一版只支持 `list`、`say`、玩家间传送、主世界坐标传送，界面是一长页。服主需要更多管理操作，现有布局放不下，也希望界面更好看。

目标：

1. 增加踢人、封禁（含原因、解封、封禁名单）、封禁 IP、白名单（增删、开关、名单）、游戏模式、三维度坐标传送。
2. 界面改为“以玩家为中心”的布局，视觉升级为精修深色风格。
3. 保持第一版的安全原则：只开放固定操作、没有任意命令入口、有影响的操作先确认、操作不自动重发、密码不落盘。

使用者不变：单个服主，两台 Windows 11 电脑，各自独立，不同步。

## 2. 已确认的决定

| 决定 | 结论 |
|---|---|
| 拆分 | 先做本子项目；地图等服主提供信息后单独设计 |
| 功能范围 | 基本的踢人、封禁、白名单增删，外加：解封与封禁名单、白名单开关与名单、踢人/封禁原因、封禁 IP |
| 布局 | 以玩家为中心：左侧导航 + 中间页面 + 右侧玩家操作抽屉 |
| 视觉 | 精修深色为底；MC 元素只保留三处点缀：维度配色、像素头像、方块感网格纹理；不做整套 MC 游戏界面 |
| 头像 | 真实皮肤头像（mc-heads.net），失败时回退到本地生成的像素头；侧栏提供“显示真实头像”开关，默认开 |
| 前端技术 | Svelte 5 + Vite（引入 npm 和构建步骤） |
| 后端结构 | 拆分模块；查询（`Query`）与操作（`Action`）两个带标签的枚举作为唯一入口 |
| 确认规则 | 三级：不确认 / 普通确认 / 危险确认（见 6.5） |

## 3. 不做的事

地图；多服务器配置；独立设置页；显示玩家坐标或当前游戏模式（`list` 拿不到）；时间、天气等其他命令；下界坐标换算；自动更新。

## 4. 架构与工程结构

### 4.1 工具链

- 仓库根目录新增 `package.json`、`vite.config.js`、`svelte.config.js`、`index.html`。依赖：`svelte`（5.x）、`vite`、`@sveltejs/vite-plugin-svelte`、`@tauri-apps/api`（2.x）；开发依赖：`vitest`、`@testing-library/svelte`、`jsdom`。版本由 `package-lock.json` 锁定。
- `tauri.conf.json`：
  - `build.beforeDevCommand: "npm run dev"`，`build.devUrl: "http://localhost:1420"`，`build.beforeBuildCommand: "npm run build"`，`build.frontendDist: "../dist"`；
  - `app.withGlobalTauri: false`，前端改用 `@tauri-apps/api/core` 的 `invoke`；
  - 窗口默认 1280×800，最小 960×640。
- Vite 固定端口 1420（`strictPort`），忽略 `src-tauri/` 的文件变化。
- CI（`windows-test.yml`）在 Rust 步骤前增加：`actions/setup-node`、`npm ci`、`npm test`、`npm run build`。打包步骤不变。
- 删除 `tests/ui-smoke.mjs`，其覆盖的流程迁移到 Vitest（见第 10 节）。删除未使用的 `src/assets/javascript.svg`、`src/assets/tauri.svg`。

### 4.2 目录结构

```
index.html
src/
  main.js                  挂载 App
  App.svelte               未连接显示连接页；已连接显示主界面
  lib/
    api.js                 所有后端调用的唯一入口（connect / reconnect / disconnect / query / perform）
    session.svelte.js      连接状态机、在线玩家 15 秒轮询、断线恢复
    history.svelte.js      今日记录（localStorage，跨日清空）
    prefs.svelte.js        本机偏好（显示真实头像）
    toasts.svelte.js       右下角通知队列
    validate.js            玩家名、坐标、原因、IP 校验（与 Rust 规则一致）
    avatar.js              玩家名 → 像素头配色与发型（确定性）
  components/              Sidebar、ServerCard、PlayerCard、PlayerDrawer、DimensionPicker、
                           GameModePicker、ConfirmDialog、Avatar、Toasts、ActivityList、Composer 等
  pages/                   Players、Bans、Whitelist、History（地图只在导航中占位）
  styles/
    tokens.css             设计变量（见 6.1）
    base.css               全局基础样式
src-tauri/src/
  lib.rs                   注册命令与状态
  rcon.rs                  凭据、打开连接、执行一条或多条命令（每次调用一个短连接）
  action.rs                Action / Query 枚举、校验、拼命令
  parse.rs                 list / whitelist / banlist 输出解析
  commands.rs              Tauri 命令
  map.rs                   继续占位
tests/fixtures/
  validation.json          前后端共用的校验用例
```

### 4.3 查询与操作

- **查询（`Query`）**：只读。可以自动刷新，失败可以重试。
- **操作（`Action`）**：会改变服务器状态。只执行一次，不自动重试；超时或回复不完整时标记“结果未知”。

前端只能提交这两个枚举中定义的项；Rust 反序列化失败即拒绝。没有任意命令入口。

## 5. 后端

### 5.1 操作（`Action`）

`perform` 接收 `{ action: { type, ... } }`，返回服务器原文（字符串）。

| `type` | 字段 | 命令 |
|---|---|---|
| `broadcast` | `message` | `say <message>` |
| `teleportToPlayer` | `player`, `target` | `tp <player> <target>` |
| `teleportToCoords` | `player`, `dimension`, `x`, `y`, `z` | `execute in minecraft:<dim> run tp <player> <x> <y> <z>` |
| `setGameMode` | `player`, `mode` | `gamemode <mode> <player>` |
| `kick` | `player`, `reason?` | `kick <player>` 或 `kick <player> <reason>` |
| `ban` | `player`, `reason?` | `ban <player>` 或 `ban <player> <reason>` |
| `banIp` | `target`, `reason?` | `ban-ip <target>` 或 `ban-ip <target> <reason>` |
| `pardon` | `player` | `pardon <player>` |
| `pardonIp` | `ip` | `pardon-ip <ip>` |
| `whitelistAdd` | `player` | `whitelist add <player>` |
| `whitelistRemove` | `player` | `whitelist remove <player>` |
| `whitelistSetEnabled` | `enabled` | `whitelist on` / `whitelist off` |

`dimension` 取值 `overworld` / `nether` / `end`，分别对应 `minecraft:overworld` / `minecraft:the_nether` / `minecraft:the_end`。`mode` 取值 `survival` / `creative` / `adventure` / `spectator`。

### 5.2 查询（`Query`）

`query` 接收 `{ query: { type } }`。

| `type` | 命令 | 返回 |
|---|---|---|
| `onlinePlayers` | `list` | `{ output, players: string[], max: number \| null }` |
| `bans` | `banlist players`，同一连接再执行 `banlist ips` | `{ playersOutput, ipsOutput, players: {name, reason}[] \| null, ips: {ip, reason}[] \| null }`；`null` 表示无法可靠解析 |
| `whitelist` | `whitelist list` | `{ output, players: string[] }` |

刷新策略：

- `onlinePlayers` 每 15 秒自动刷新，同时承担自动重连（与第一版相同）。
- `bans`、`whitelist` 只在打开对应页面、手动刷新、或相关操作（封禁、解封、白名单增删）得到服务器回复后各查询一次，不自动轮询。

### 5.3 校验规则

- 玩家名：`^[A-Za-z0-9_]{3,16}$`（不变）。
- 广播：去掉首尾空白后 1–256 个字符，不含控制字符（不变）。
- 原因：可选；去掉首尾空白后为空则视为没有原因；不超过 100 个字符；不含控制字符。
- 坐标：有限数字，绝对值不超过 29,999,984（不变）。
- IP：能被 Rust `std::net::IpAddr` 解析。
- `banIp.target`：能解析为 IP 就按 IP 处理，否则必须是合法玩家名。两种格式不会重叠（玩家名不含 `.` 和 `:`）。
- `teleportToPlayer` 的两名玩家不能相同（不变）。
- 服务器名称：去掉首尾空白后非空，不超过 60 个字符（按字符计，不变）。

消息和原因中的 `@a` 等写法会由服务器按原版规则展开为玩家名，这是纯文本效果，不构成命令注入，不做拦截。

前后端共用 `tests/fixtures/validation.json`：列出合法与不合法的玩家名、原因、IP 样例。`cargo test` 和 Vitest 都读取这份文件，规则不一致时测试失败。

### 5.4 输出解析

- `list`：取最后一个 `:` 之后的内容，按 `,` 分割，只保留合法玩家名（不变）。最大人数从“of a max of N”中读取，读不到时为 `null`。
- `whitelist list`：同样的方法；输出中没有 `:`（如“There are no whitelisted players”）时返回空列表。
- `banlist players` / `banlist ips`：
  1. 输出以“There are no bans”开头时，返回空列表。
  2. 从“There are N ban(s)”中读出 N，去掉到 `ban(s):` 为止的前缀。
  3. 剩余内容按换行分割，每行匹配 `<名称> was banned by <来源>: <原因>`。
  4. 匹配出的条数等于 N 时返回解析结果，否则返回 `null`。

  RCON 回复可能丢失换行，导致多条记录连在一起。此时第 4 步条数对不上，界面退回到“显示原文 + 手动输入解封”的方式，不会给出错误的解封按钮。

### 5.5 Tauri 命令

| 命令 | 说明 |
|---|---|
| `connect_rcon(profile, password)` | 不变 |
| `reconnect_rcon()` | 不变 |
| `disconnect_rcon()` | 不变 |
| `query(query)` | 替换原 `list_players` |
| `perform(action)` | 替换原 `broadcast`、`teleport_to_player`、`teleport_to_coords` |

### 5.6 错误模型

沿用 `AppError { kind, message }`，`kind` 仍为 `invalid_input` / `disconnected` / `unknown` / `internal`：

- 打开连接或认证失败：`disconnected`（命令肯定没有发出）。
- 命令已发出但超时或回复不完整：`unknown`。
- 服务器的回复（包括它自己报告的错误，例如找不到玩家）一律作为成功返回原文，由界面原样展示。

## 6. 前端

### 6.1 视觉规范

以视觉参考稿为准，`tokens.css` 至少定义：

- 背景层次：`--bg #060b0e`、`--s1 #0a1216`、`--s2 #0d171b`、`--card #111e23`、`--card-hi #16262d`
- 线条：`--line rgba(255,255,255,.055)`、`--line-2 rgba(255,255,255,.1)`
- 文字：`--text #e8f3ef`、`--text-2 #9fb5ad`、`--text-3 #66807a`
- 强调：`--mint #8ee6be`；警示 `--amber #f3c56e`；危险 `--coral #ff8f7e`
- 维度：`--over #7fdc8f`、`--nether #ff7152`、`--end #b893ff`
- 圆角 14px（卡片）/ 10–11px（控件）；字体只用系统字体：`Segoe UI Variable`、`Microsoft YaHei UI`，等宽用 `Cascadia Code` / `Consolas`，不打包字体文件。
- 图标：Lucide（ISC 许可），线性风格，1.8 描边。

MC 元素只允许出现在：维度选择的配色与小方块图标、玩家像素头像、背景的淡网格纹理。其他地方不使用像素字体、石头纹理或立体按钮。

动效：悬停时卡片轻微上浮、边框变亮；抽屉滑入；连接状态点呼吸闪烁。系统开启“减少动画”时关闭这些动效。

### 6.2 界面状态

- **未连接**：窗口中央一张连接卡片（服务器名称、RCON 地址、端口、密码、连接按钮）。名称、地址、端口从本机记住的值预填；密码每次启动都要输入。
- **已连接**：左侧栏 + 页面 + 右侧抽屉（三栏）。
- **正在重连**：侧栏状态点变为琥珀色；页面顶部显示一条连接提示；所有操作按钮置灰；在线玩家查询按 15 秒节奏继续自动重试。
- 主动断开或关闭应用后，密码从 Rust 进程中清除（不变）。

### 6.3 侧栏

从上到下：品牌（爪印 logo + Pawkit）；服务器卡片（名称、地址、状态点、最近刷新时间、“显示真实头像”开关）；导航（玩家、封禁名单、白名单、今日记录，分隔线后是置灰的“地图 · 即将推出”）；底部“断开连接”。

### 6.4 页面

- **玩家**：标题与在线人数（“4 / 20”，最大人数从 `list` 输出中解析，解析不到就只显示在线人数）；“输入玩家名”按钮和刷新按钮；广播输入框（带 0/256 计数）；玩家卡片网格，末尾是“对不在线的玩家操作”卡片；下方显示最近 3 条操作记录，并链接到今日记录。
- **封禁名单**：“玩家”和“IP”两个标签。每个标签都有可折叠的服务器原文；可以解析时列出条目（名称或 IP、原因、“解封”按钮），无法解析时显示说明文字和手动解封输入框。“IP”标签另有“封禁 IP 地址”输入框（可填原因）。
- **白名单**：名单列表，每项带“移除”；“添加玩家”输入框；“开启白名单”“关闭白名单”两个按钮（原版没有查询开关状态的命令，所以不显示当前状态）；服务器原文。
- **今日记录**：完整列表，每条显示时间、操作、状态（服务器已回复 / 结果未知 / 未执行）、服务器原文和“复制”按钮。规则与第一版相同：只保留当天，跨日清空。

### 6.5 操作抽屉

点击玩家卡片，或输入玩家名后打开。内容：

1. 头部：头像、玩家名、在线或离线状态、关闭按钮。
2. 传送：“到玩家 / 到坐标”切换。“到玩家”从在线玩家中选择目标；“到坐标”选维度（三块带维度配色的按钮），填 X、Y、Z，按钮文字写明目的地（如“传送到下界 120, 64, -30”）。
3. 游戏模式：生存、创造、冒险、旁观四个按钮。
4. 白名单：“加入白名单”“移出白名单”。
5. 管理操作（淡红底色区域）：原因输入框（三个按钮共用），“踢出”“封禁”“封 IP”三个按钮。“封 IP”以玩家名作为 `banIp.target`。

玩家不在线时（手动输入的名字不在最新名单里，或刷新后已离线；比较时不区分大小写，与 Minecraft 一致）：传送、游戏模式、踢出、封 IP 置灰并注明“玩家不在线”；封禁和白名单照常可用。刷新后玩家离线不会关闭抽屉，只更新状态。

### 6.6 确认规则

| 级别 | 操作 | 形式 |
|---|---|---|
| 不确认 | 广播、所有查询与刷新 | 直接执行 |
| 普通确认 | 传送（两种）、游戏模式、踢出、白名单增删、解封、解封 IP | 弹窗写明对谁做什么；回车 = 确认 |
| 危险确认 | 封禁、封禁 IP、白名单开启、白名单关闭 | 红色弹窗，写明后果；默认焦点在“取消”，回车 = 取消，必须用鼠标点击“确认” |

危险确认的后果文案：

- 封禁：“<玩家> 将无法再进入服务器，直到被解封。”
- 封禁 IP：“同一网络（IP）下的所有人都将无法进入服务器。”
- 开启白名单：“不在白名单上的玩家将无法进入服务器。”
- 关闭白名单：“任何知道服务器地址的人都可以进入。”

确认前不调用后端。

### 6.7 反馈

- 同一时间只执行一个操作：被点击的按钮显示转圈，其他操作按钮暂时置灰（查询不受影响）。
- 结果通知显示在右下角：
  - 服务器已回复：附服务器原文，5 秒后自动消失；
  - 结果未知：琥珀色，不自动消失，需手动关闭；同时进入“正在重连”状态（与第一版相同）；
  - 输入无效：显示在对应输入框下方，不弹通知。
- 每次操作、以及用户手动点击刷新的查询，都写入今日记录；自动轮询和打开页面时的查询不写入。
- 第一版页面顶部的通知栏取消，由上述通知和断线时出现的连接提示代替。

### 6.8 响应式

- 窗口宽度 ≥ 1200px：三栏并排。
- 窄于 1200px：抽屉改为从右侧滑出、覆盖在页面上方，点击遮罩或按 Esc 关闭。
- 最小窗口 960×640。

### 6.9 本机存储

| 键 | 内容 |
|---|---|
| `pawkit.profile.v1` | 服务器名称、地址、端口（不变，不含密码） |
| `pawkit.history.v1` | 今日记录（格式不变） |
| `pawkit.prefs.v1` | `{ realAvatars: boolean }`，默认 `true` |

## 7. 头像

- `Avatar` 组件先立即画出本地像素头：用玩家名的哈希确定肤色、发色、眼睛颜色和发型（从固定调色板和若干发型中选择），以内联 SVG 绘制。同一个名字的结果永远一样。
- `realAvatars` 为真时，再加载 `https://mc-heads.net/avatar/<玩家名>/64`：加载成功后淡入覆盖；失败则保持生成头像，不提示。
- 只有通过玩家名校验的名字才会拼进网址。
- 关闭开关后不再发起任何头像请求。
- 已知限制：离线模式（盗版）服务器的玩家名对应不到正版账号，真实头像会显示错，此时关闭开关即可；开启时玩家名会发送给 mc-heads.net。

## 8. 安全

- 生产 CSP：`default-src 'self'; img-src 'self' https://mc-heads.net; connect-src ipc: http://ipc.localhost`。
- 开发模式用 Tauri 的 `devCsp` 另行放开 Vite 热更新所需的本地连接，不影响正式版。
- 若打包后实测 Svelte 运行时需要内联样式，只给 `style-src` 增加 `'unsafe-inline'`，其他规则不变，并在 ARCHITECTURE.md 中记录原因。
- 若 mc-heads.net 的头像地址会重定向到其他域名，需要把实际图片域名也加入 `img-src`；实施时先确认。
- 其余沿用第一版：固定操作、双层校验、密码只在内存、不自动重发操作。

## 9. 错误处理汇总

| 情况 | 处理 |
|---|---|
| 输入无效 | 前端拦截并提示在输入框下方；后端再校验一次 |
| 未连接 / 连接失败 | 进入“正在重连”，在线玩家查询自动重试，操作按钮置灰 |
| 结果未知 | 琥珀色常驻通知 + 记录 + 进入“正在重连”；不自动重发 |
| 内部错误 | 通知 + 记录 |
| 头像加载失败 | 静默使用生成头像 |
| 本机存储写入失败 | 提示一次（不变） |

## 10. 测试

### Rust（`cargo test`）

- 每个 `Action` 的拼命令测试，以及拒绝测试：换行注入、选择器、非法 IP、越界坐标、非法维度和模式、超长原因。
- 解析测试：`list`、`whitelist list`（有人 / 无人），`banlist`（无封禁、单条、多条有换行、多条无换行 → `null`、条数不符 → `null`）。
- 读取 `tests/fixtures/validation.json` 的共用校验用例。
- 模拟 RCON 服务器：认证 + 单条命令（保留现有测试）；一个连接内连续执行两条命令（`bans` 查询）。
- 服务器名称按字符计数的回归测试（保留）。

### 前端（Vitest）

- `validate.js`：读取同一份 `validation.json`。
- `avatar.js`：同名结果相同，不同名结果有差异。
- `session.svelte.js`（模拟 `api`）：连接成功、轮询、断线进入重连、恢复、断开后丢弃过期结果。
- 组件测试（@testing-library/svelte + jsdom）：
  - 离线玩家的传送、游戏模式、踢出、封 IP 置灰；
  - 危险确认弹窗中按回车等于取消，且不调用后端；
  - 普通确认取消时不调用后端；
  - “结果未知”通知不会自动消失；
  - 关闭“显示真实头像”后不渲染远程图片。
- 迁移 `ui-smoke.mjs` 覆盖的流程：连接、广播、两种传送（含确认与取消）、断线与恢复、记录写入、密码不写入本机存储。

### 打包后人工检查

安装包在 CSP 生效的情况下：页面样式正常、所有页面能打开、IPC 正常、头像能加载或正确回退。

## 11. 验收（在第一版验收基础上新增）

1. 踢出（有原因 / 无原因）在游戏内生效，原因显示给玩家。
2. 封禁、解封在线与离线玩家；封禁名单能显示，解析失败时能手动解封。
3. 封禁 IP、解封 IP。
4. 白名单增删、开启、关闭，名单能显示。
5. 四种游戏模式切换正确。
6. 主世界、下界、末地坐标传送正确。
7. 危险操作必须点击确认；回车不会误触发。
8. 真实头像能加载；断网或关闭开关时显示生成头像。
9. 窗口缩窄到 960 宽时抽屉改为覆盖式，仍可正常操作。

验收时记录服务端软件与版本，以及 `banlist` 的原始输出是否带换行。

## 12. 风险与待验证

1. **RCON 回复是否保留换行**：影响封禁名单解析。已有退回方案；需在真实服务器上确认。
2. **命令被插件覆盖**：Spigot/Paper 上的 EssentialsX 等插件可能接管 `ban`、`kick` 等命令，回复格式和行为会不同。界面始终显示服务器原文；需确认服务器是否装有此类插件。
3. **严格 CSP 下的 Svelte**：在安装包中实测，必要时按第 8 节放宽 `style-src`。
4. **mc-heads.net 的可访问性**：服主网络可能打不开，回退方案已覆盖。
5. **服务端版本**：`execute in` 需要 Java 版 1.13 及以上；需确认服务器版本。

## 13. 子项目 2（地图）需要的信息

请服主提供：服务端类型和版本（原版 / Paper / Fabric / Forge + MC 版本）；已安装或愿意安装的地图插件（BlueMap / Dynmap / squaremap 等）；地图网页地址，以及两台电脑能否访问它。拿到后再单独设计。地图的数据入口保持与 RCON 命令入口分开（与第一版架构说明一致）。
