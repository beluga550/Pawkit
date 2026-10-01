<script>
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import { untrack } from "svelte";
  import PageHeader from "../components/PageHeader.svelte";
  import RawOutput from "../components/RawOutput.svelte";
  import { useApp } from "../lib/context.js";
  import { executeOperation } from "../lib/operations.js";
  import { checkBanIpTarget, checkIp, checkPlayer, checkReason } from "../lib/validate.js";

  const app = useApp();
  const { session } = app;

  let tab = $state("players");
  let data = $state(null);
  let loadFailed = $state(false);
  let manualName = $state("");
  let banTarget = $state("");
  let banReason = $state("");
  let errors = $state({});

  const ready = $derived(session.status === "connected" && !session.pending);
  const list = $derived(tab === "players" ? data?.players : data?.ips);
  const output = $derived(tab === "players" ? data?.playersOutput : data?.ipsOutput);

  async function load(manual = false) {
    const result = await session.query("bans", { manual, label: "刷新封禁名单" });
    if (result) data = result;
    loadFailed = !result;
  }

  // Load on open, and again whenever a ban or pardon gets a server reply.
  $effect(() => {
    session.revisions.bans;
    // Also reload when the connection comes back, so a failed first load recovers.
    if (session.status === "connected") untrack(() => load());
  });

  const run = (action) => executeOperation(app, action);

  function manualPardon(event) {
    event.preventDefault();
    const value = manualName.trim();
    const checked = tab === "players" ? checkPlayer(value) : checkIp(value);
    errors = { ...errors, manual: checked.ok ? "" : checked.error };
    if (!checked.ok) return;
    run(tab === "players" ? { type: "pardon", player: value } : { type: "pardonIp", ip: value });
  }

  function banIp(event) {
    event.preventDefault();
    const target = checkBanIpTarget(banTarget.trim());
    const reason = checkReason(banReason);
    errors = { ...errors, target: target.ok ? "" : target.error, reason: reason.ok ? "" : reason.error };
    if (!target.ok || !reason.ok) return;
    run({ type: "banIp", target: target.value, reason: reason.value });
  }
</script>

<PageHeader kicker="BANS" title="封禁名单" sub="打开页面或封禁、解封后自动更新">
  {#snippet actions()}
    <button class="btn ghost icon" type="button" aria-label="刷新封禁名单" title="刷新封禁名单" onclick={() => load(true)}>
      <RefreshCw size={16} strokeWidth={1.8} />
    </button>
  {/snippet}
</PageHeader>

<div class="tabs" role="tablist">
  <button type="button" role="tab" aria-selected={tab === "players"} class:on={tab === "players"} onclick={() => (tab = "players")}>
    玩家{#if data?.players}<span class="n">{data.players.length}</span>{/if}
  </button>
  <button type="button" role="tab" aria-selected={tab === "ips"} class:on={tab === "ips"} onclick={() => (tab = "ips")}>
    IP{#if data?.ips}<span class="n">{data.ips.length}</span>{/if}
  </button>
</div>

<section class="panel body">
  {#if !data && loadFailed}
    <p class="muted">读取失败。连接恢复后会自动重试，也可以点右上角的刷新按钮。</p>
  {:else if !data}
    <p class="muted">正在读取封禁名单…</p>
  {:else if list === null}
    <p class="notice">
      服务器返回的名单无法可靠解析（可能缺少换行，或服务器装了改写命令的插件）。请查看下方原文，手动输入要解封的{tab === "players" ? "玩家名" : " IP"}。
    </p>
    <form class="inline" onsubmit={manualPardon} novalidate>
      <label class="field grow">
        <span class="sr-only">{tab === "players" ? "要解封的玩家名" : "要解封的 IP"}</span>
        <input
          class="input mono"
          bind:value={manualName}
          aria-label={tab === "players" ? "要解封的玩家名" : "要解封的 IP"}
          aria-invalid={Boolean(errors.manual)}
          placeholder={tab === "players" ? "玩家名" : "IP 地址"}
        />
        {#if errors.manual}<span class="field-error">{errors.manual}</span>{/if}
      </label>
      <button class="btn ghost" type="submit" disabled={!ready}>手动解封</button>
    </form>
  {:else if list.length === 0}
    <p class="muted">{tab === "players" ? "没有被封禁的玩家。" : "没有被封禁的 IP。"}</p>
  {:else}
    <ul>
      {#each list as entry (entry.name ?? entry.ip)}
        <li>
          <span class="who mono">{entry.name ?? entry.ip}</span>
          <span class="why">{entry.reason}</span>
          <button
            class="btn ghost"
            type="button"
            disabled={!ready}
            onclick={() => run(entry.name ? { type: "pardon", player: entry.name } : { type: "pardonIp", ip: entry.ip })}
          >
            解封
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  {#if data}<RawOutput {output} />{/if}
</section>

{#if tab === "ips"}
  <form class="panel ban-ip" onsubmit={banIp} novalidate>
    <h3>封禁 IP 地址</h3>
    <div class="inline">
      <label class="field grow">
        <span class="sr-only">IP 地址或玩家名</span>
        <input class="input mono" bind:value={banTarget} aria-label="IP 地址或玩家名" placeholder="IP 地址，或在线玩家名" aria-invalid={Boolean(errors.target)} />
        {#if errors.target}<span class="field-error">{errors.target}</span>{/if}
      </label>
      <label class="field grow">
        <span class="sr-only">封禁原因</span>
        <input class="input" bind:value={banReason} aria-label="封禁原因" placeholder="原因（可选）" aria-invalid={Boolean(errors.reason)} />
        {#if errors.reason}<span class="field-error">{errors.reason}</span>{/if}
      </label>
      <button class="btn bad" type="submit" disabled={!ready}>封禁 IP 地址</button>
    </div>
    <p class="muted">同一网络（IP）下的所有人都将无法进入服务器。执行前会再次确认。</p>
  </form>
{/if}

<style>
  .tabs {
    display: inline-flex;
    gap: 4px;
    padding: 3px;
    border-radius: 11px;
    border: 1px solid var(--line);
    background: rgba(0, 0, 0, 0.25);
    align-self: flex-start;
  }
  .tabs button {
    border: 0;
    background: transparent;
    padding: 7px 16px;
    border-radius: 8px;
    color: var(--text-2);
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .tabs button.on {
    background: var(--card-hi);
    color: var(--text);
  }
  .n {
    font-size: 11px;
    color: var(--text-3);
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  ul {
    list-style: none;
    padding: 0;
  }
  li {
    display: grid;
    grid-template-columns: 180px minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    border-top: 1px solid var(--line);
  }
  li:first-child {
    border-top: 0;
  }
  .why {
    color: var(--text-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .notice {
    padding: 10px 12px;
    border-radius: var(--radius-control);
    background: rgba(243, 197, 110, 0.08);
    color: var(--amber);
    line-height: 1.6;
  }
  .inline {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }
  .grow {
    flex: 1;
  }
  .ban-ip {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  h3 {
    font-size: 12px;
    letter-spacing: 0.14em;
    color: var(--text-3);
  }
  .muted {
    font-size: 12.5px;
  }
</style>
