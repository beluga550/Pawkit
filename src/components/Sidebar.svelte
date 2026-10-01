<script>
  import Ban from "@lucide/svelte/icons/ban";
  import History from "@lucide/svelte/icons/history";
  import LogOut from "@lucide/svelte/icons/log-out";
  import MapIcon from "@lucide/svelte/icons/map";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import Users from "@lucide/svelte/icons/users";
  import { useApp } from "../lib/context.js";
  import PawLogo from "./PawLogo.svelte";
  import ServerCard from "./ServerCard.svelte";

  const { session, history, ui } = useApp();

  const items = $derived([
    { page: "players", label: "玩家", icon: Users, badge: session.players.length },
    { page: "bans", label: "封禁名单", icon: Ban, badge: null },
    { page: "whitelist", label: "白名单", icon: ShieldCheck, badge: null },
    { page: "history", label: "今日记录", icon: History, badge: history.entries.length },
  ]);
</script>

<aside class="side" aria-label="侧栏">
  <div class="brand">
    <span class="logo"><PawLogo /></span>
    <div><strong>Pawkit</strong><small>服务器控制台</small></div>
  </div>
  <ServerCard />
  <div class="navlabel">管理</div>
  <nav>
    {#each items as item (item.page)}
      <button
        type="button"
        class="nav"
        class:on={ui.page === item.page}
        aria-current={ui.page === item.page ? "page" : undefined}
        onclick={() => ui.go(item.page)}
      >
        <item.icon size={18} strokeWidth={1.8} />
        {item.label}
        {#if item.badge !== null}<span class="badge">{item.badge}</span>{/if}
      </button>
    {/each}
    <div class="sep"></div>
    <div class="nav soon" aria-disabled="true">
      <MapIcon size={18} strokeWidth={1.8} />地图<span class="soon-tag">即将推出</span>
    </div>
  </nav>
  <button type="button" class="foot" disabled={Boolean(session.pending)} onclick={() => session.disconnect()}>
    <LogOut size={18} strokeWidth={1.8} />断开连接
  </button>
</aside>

<style>
  .side {
    background: linear-gradient(180deg, rgba(10, 18, 22, 0.92), rgba(8, 14, 17, 0.96));
    border-right: 1px solid var(--line);
    padding: 20px 14px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    position: relative;
    z-index: 1;
    overflow-y: auto;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 2px 6px;
  }
  .brand strong {
    font-family: var(--display);
    font-size: 17px;
    display: block;
  }
  .brand small {
    color: var(--text-3);
    font-size: 11.5px;
  }
  .logo {
    width: 38px;
    height: 38px;
    border-radius: 11px;
    display: grid;
    place-items: center;
    color: #06231a;
    background: linear-gradient(145deg, #b9f5d9, #5fd3a0);
    box-shadow: 0 6px 18px -6px rgba(95, 211, 160, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.5);
  }
  .navlabel {
    font-size: 10.5px;
    letter-spacing: 0.14em;
    color: var(--text-3);
    padding: 0 8px;
    margin-bottom: -10px;
  }
  nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .nav {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 9px 10px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--text-2);
    font-size: 13.5px;
    text-align: left;
    position: relative;
    transition: background 0.15s, color 0.15s;
  }
  button.nav:hover {
    background: rgba(255, 255, 255, 0.035);
    color: var(--text);
  }
  .nav.on {
    background: linear-gradient(90deg, rgba(142, 230, 190, 0.13), rgba(142, 230, 190, 0.04));
    color: #d9fbeb;
  }
  .nav.on::before {
    content: "";
    position: absolute;
    left: -14px;
    top: 9px;
    bottom: 9px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: var(--mint);
  }
  .badge {
    margin-left: auto;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--text-3);
    background: rgba(255, 255, 255, 0.05);
    border-radius: 999px;
    padding: 1px 8px;
  }
  .nav.on .badge {
    color: #06231a;
    background: var(--mint);
  }
  .soon {
    opacity: 0.5;
    cursor: default;
  }
  .soon-tag {
    margin-left: auto;
    font-size: 10.5px;
    color: var(--text-3);
    border: 1px dashed var(--line-2);
    border-radius: 999px;
    padding: 0 7px;
  }
  .sep {
    height: 1px;
    background: var(--line);
    margin: 2px 8px;
  }
  .foot {
    margin-top: auto;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 9px 10px;
    border-radius: 10px;
    color: var(--text-3);
    font-size: 13px;
    background: transparent;
    border: 1px solid var(--line);
  }
  .foot:hover:not(:disabled) {
    color: var(--coral);
    border-color: rgba(255, 143, 126, 0.3);
  }
</style>
