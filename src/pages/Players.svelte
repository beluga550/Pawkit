<script>
  import Plus from "@lucide/svelte/icons/plus";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import ActivityList from "../components/ActivityList.svelte";
  import Composer from "../components/Composer.svelte";
  import PageHeader from "../components/PageHeader.svelte";
  import PlayerCard from "../components/PlayerCard.svelte";
  import PlayerLookup from "../components/PlayerLookup.svelte";
  import { useApp } from "../lib/context.js";

  const { session, ui, prefs, history } = useApp();
  let lookupOpen = $state(false);

  function openFromLookup(name) {
    ui.openPlayer(name);
    lookupOpen = false;
  }
</script>

<PageHeader kicker="PLAYERS" title="在线玩家" sub="每 15 秒自动刷新 · 点选玩家后在右侧操作">
  {#snippet aside()}
    <b>{session.players.length}</b>{#if session.max !== null}&nbsp;/ {session.max}{/if}
  {/snippet}
  {#snippet actions()}
    <button class="btn ghost" type="button" onclick={() => (lookupOpen = !lookupOpen)}>
      <Plus size={16} strokeWidth={1.8} />输入玩家名
    </button>
    <button
      class="btn ghost icon"
      type="button"
      aria-label="刷新在线玩家"
      title="刷新在线玩家"
      onclick={() => session.refreshPlayers({ manual: true })}
    >
      <RefreshCw size={16} strokeWidth={1.8} />
    </button>
  {/snippet}
</PageHeader>

{#if lookupOpen}
  <PlayerLookup onopen={openFromLookup} oncancel={() => (lookupOpen = false)} />
{/if}

<Composer />

<div class="grid">
  {#each session.players as name (name)}
    <PlayerCard
      {name}
      real={prefs.realAvatars}
      selected={ui.drawerPlayer?.toLowerCase() === name.toLowerCase()}
      onclick={() => ui.openPlayer(name)}
    />
  {/each}
  <button type="button" class="add" onclick={() => (lookupOpen = true)}>
    <Plus size={16} strokeWidth={1.8} />对不在线的玩家操作
  </button>
</div>
{#if session.players.length === 0}
  <p class="empty">没有识别出在线玩家，也可以手动输入玩家名进行操作。</p>
{/if}

<section class="panel">
  <h3>
    最近操作
    <button type="button" class="link" onclick={() => ui.go("history")}>查看全部 →</button>
  </h3>
  <ActivityList entries={history.recent(3)} />
</section>

<style>
  b {
    color: var(--text);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }
  .add {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 68px;
    border-radius: var(--radius);
    border: 1px dashed var(--line-2);
    background: transparent;
    color: var(--text-3);
    font-size: 13px;
  }
  .add:hover {
    color: var(--text);
    border-color: rgba(142, 230, 190, 0.35);
  }
  .empty {
    color: var(--text-3);
    font-size: 12.5px;
  }
  h3 {
    font-size: 12px;
    letter-spacing: 0.14em;
    color: var(--text-3);
    font-weight: 700;
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .link {
    border: 0;
    background: transparent;
    color: var(--mint);
    font-weight: 600;
    letter-spacing: 0;
    font-size: 12px;
  }
</style>
