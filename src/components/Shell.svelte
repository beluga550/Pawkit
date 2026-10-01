<script>
  import { useApp } from "../lib/context.js";
  import Bans from "../pages/Bans.svelte";
  import History from "../pages/History.svelte";
  import Players from "../pages/Players.svelte";
  import Whitelist from "../pages/Whitelist.svelte";
  import ReconnectBanner from "./ReconnectBanner.svelte";
  import Sidebar from "./Sidebar.svelte";

  const { session, ui } = useApp();
</script>

<div class="shell">
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
</style>
