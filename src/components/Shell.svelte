<script>
  import { useApp } from "../lib/context.js";
  import Bans from "../pages/Bans.svelte";
  import History from "../pages/History.svelte";
  import Players from "../pages/Players.svelte";
  import Whitelist from "../pages/Whitelist.svelte";
  import ReconnectBanner from "./ReconnectBanner.svelte";
  import PlayerDrawer from "./PlayerDrawer.svelte";
  import Sidebar from "./Sidebar.svelte";

  const { session, ui } = useApp();
</script>

<div class="shell" class:has-drawer={Boolean(ui.drawerPlayer)}>
  <Sidebar />
  <main class="main">
    {#if session.status === "reconnecting"}<ReconnectBanner />{/if}
    {#if ui.page === "players"}
      <Players />
    {:else if ui.page === "bans"}
      <Bans />
    {:else if ui.page === "whitelist"}
      <Whitelist />
    {:else}
      <History />
    {/if}
  </main>
  {#if ui.drawerPlayer}
    <button class="scrim" type="button" tabindex="-1" aria-label="关闭玩家操作" onclick={() => ui.closeDrawer()}></button>
    <div class="drawer-slot">
      {#key ui.drawerPlayer}<PlayerDrawer />{/key}
    </div>
  {/if}
</div>

<style>
  .shell {
    display: grid;
    grid-template-columns: 232px minmax(0, 1fr);
    height: 100vh;
    min-width: 960px;
    position: relative;
    background:
      radial-gradient(900px 420px at 18% -10%, rgba(142, 230, 190, 0.08), transparent 60%),
      radial-gradient(700px 400px at 100% 110%, rgba(184, 147, 255, 0.06), transparent 60%),
      var(--s2);
  }
  /* Faint block grid: one of the three allowed Minecraft touches. */
  .shell::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image: linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px);
    background-size: 32px 32px;
    opacity: 0.35;
    mask-image: radial-gradient(800px 500px at 40% 0%, #000, transparent 75%);
  }
  .main {
    padding: 26px 28px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    min-width: 0;
    overflow-y: auto;
    position: relative;
    z-index: 1;
  }
  .drawer-slot {
    display: flex;
    flex-direction: column;
    min-height: 0;
    position: relative;
    z-index: 2;
  }
  .drawer-slot > :global(.drawer) {
    flex: 1;
  }
  .scrim {
    display: none;
  }
  /* Wide windows: three columns side by side. */
  @media (min-width: 1200px) {
    .shell.has-drawer {
      grid-template-columns: 232px minmax(0, 1fr) 336px;
    }
  }
  /* Narrow windows: the drawer slides over the page. */
  @media (max-width: 1199px) {
    .drawer-slot {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: 336px;
      z-index: 20;
    }
    .scrim {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 19;
      border: 0;
      background: rgba(3, 7, 10, 0.55);
      cursor: default;
    }
  }
</style>
