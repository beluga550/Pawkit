<script>
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import ShieldOff from "@lucide/svelte/icons/shield-off";
  import { untrack } from "svelte";
  import PageHeader from "../components/PageHeader.svelte";
  import RawOutput from "../components/RawOutput.svelte";
  import { useApp } from "../lib/context.js";
  import { executeOperation } from "../lib/operations.js";
  import { checkPlayer } from "../lib/validate.js";

  const app = useApp();
  const { session } = app;

  let data = $state(null);
  let name = $state("");
  let error = $state("");
  const ready = $derived(session.status === "connected" && !session.pending);

  async function load(manual = false) {
    const result = await session.query("whitelist", { manual, label: "刷新白名单" });
    if (result) data = result;
  }

  $effect(() => {
    session.revisions.whitelist;
    untrack(() => load());
  });

  const run = (action) => executeOperation(app, action);

  async function add(event) {
    event.preventDefault();
    const checked = checkPlayer(name.trim());
    error = checked.ok ? "" : checked.error;
    if (!checked.ok) return;
    const result = await run({ type: "whitelistAdd", player: checked.value });
    if (result.ok) name = "";
  }
</script>

<PageHeader kicker="WHITELIST" title="白名单" sub="原版没有查询白名单开关状态的命令，所以这里不显示当前是开还是关">
  {#snippet aside()}{#if data}{data.players.length} 人{/if}{/snippet}
  {#snippet actions()}
    <button class="btn ghost" type="button" disabled={!ready} onclick={() => run({ type: "whitelistSetEnabled", enabled: true })}>
      <ShieldCheck size={16} strokeWidth={1.8} />开启白名单
    </button>
    <button class="btn ghost" type="button" disabled={!ready} onclick={() => run({ type: "whitelistSetEnabled", enabled: false })}>
      <ShieldOff size={16} strokeWidth={1.8} />关闭白名单
    </button>
    <button class="btn ghost icon" type="button" aria-label="刷新白名单" title="刷新白名单" onclick={() => load(true)}>
      <RefreshCw size={16} strokeWidth={1.8} />
    </button>
  {/snippet}
</PageHeader>

<form class="panel add" onsubmit={add} novalidate>
  <label class="field grow">
    <span class="sr-only">要加入白名单的玩家名</span>
    <input class="input mono" bind:value={name} aria-label="要加入白名单的玩家名" placeholder="玩家名，例如 Kai_Builds" aria-invalid={Boolean(error)} />
    {#if error}<span class="field-error">{error}</span>{/if}
  </label>
  <button class="btn primary" type="submit" disabled={!ready}>添加</button>
</form>

<section class="panel body">
  {#if !data}
    <p class="muted">正在读取白名单…</p>
  {:else if data.players.length === 0}
    <p class="muted">白名单里还没有玩家。</p>
  {:else}
    <ul>
      {#each data.players as player (player)}
        <li>
          <span class="mono">{player}</span>
          <button class="btn ghost" type="button" disabled={!ready} onclick={() => run({ type: "whitelistRemove", player })}>移除</button>
        </li>
      {/each}
    </ul>
  {/if}
  {#if data}<RawOutput output={data.output} />{/if}
</section>

<style>
  .add {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }
  .grow {
    flex: 1;
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  ul {
    list-style: none;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 8px;
  }
  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 6px 6px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: rgba(255, 255, 255, 0.02);
  }
  li .btn {
    height: 30px;
    font-size: 12px;
  }
  .muted {
    font-size: 12.5px;
  }
</style>
