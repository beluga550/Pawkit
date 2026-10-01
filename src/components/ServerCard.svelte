<script>
  import { useApp } from "../lib/context.js";

  const { session, prefs } = useApp();

  let clock = $state(Date.now());
  $effect(() => {
    const timer = setInterval(() => (clock = Date.now()), 1000);
    return () => clearInterval(timer);
  });

  const secondsAgo = $derived(
    session.lastRefresh ? Math.max(0, Math.round((clock - session.lastRefresh.getTime()) / 1000)) : null,
  );
  const statusText = $derived(
    session.status === "reconnecting"
      ? "正在重连"
      : secondsAgo === null
        ? "已连接"
        : `已连接 · ${secondsAgo} 秒前刷新`,
  );
</script>

<div class="server">
  <div class="name">{session.profile?.name}</div>
  <div class="addr mono">{session.profile?.host}:{session.profile?.port}</div>
  <div class="live" class:warn={session.status === "reconnecting"}>
    <span class="pulse"></span>{statusText}
  </div>
  <label class="switch" title="开启后会把玩家名发送给 mc-heads.net 以获取皮肤；离线模式服务器建议关闭">
    <input
      type="checkbox"
      role="switch"
      checked={prefs.realAvatars}
      onchange={(event) => (prefs.realAvatars = event.currentTarget.checked)}
    />
    <span class="track" aria-hidden="true"></span>
    显示真实头像
  </label>
</div>

<style>
  .server {
    background: linear-gradient(180deg, var(--card-hi), var(--card));
    border: 1px solid var(--line-2);
    border-radius: 12px;
    padding: 12px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }
  .name {
    font-weight: 650;
    font-size: 13.5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .addr {
    font-size: 11.5px;
    color: var(--text-3);
    margin-top: 3px;
  }
  .live {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11.5px;
    color: var(--mint);
    margin-top: 10px;
  }
  .pulse {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
    animation: pulse 2.2s infinite;
  }
  .live.warn {
    color: var(--amber);
  }
  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 55%, transparent);
    }
    70% {
      box-shadow: 0 0 0 8px transparent;
    }
    100% {
      box-shadow: 0 0 0 0 transparent;
    }
  }
  .switch {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--line);
    font-size: 12px;
    color: var(--text-2);
    cursor: pointer;
  }
  .switch input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .track {
    position: relative;
    width: 28px;
    height: 16px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
    transition: background 0.15s;
  }
  .track::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--text-2);
    transition: transform 0.15s, background 0.15s;
  }
  .switch input:checked + .track {
    background: rgba(142, 230, 190, 0.35);
  }
  .switch input:checked + .track::after {
    transform: translateX(12px);
    background: var(--mint);
  }
  .switch input:focus-visible + .track {
    outline: 2px solid var(--mint);
    outline-offset: 2px;
  }
</style>
