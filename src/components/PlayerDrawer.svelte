<script>
  import Ban from "@lucide/svelte/icons/ban";
  import Globe from "@lucide/svelte/icons/globe";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import LogOut from "@lucide/svelte/icons/log-out";
  import Navigation from "@lucide/svelte/icons/navigation";
  import UserMinus from "@lucide/svelte/icons/user-minus";
  import UserPlus from "@lucide/svelte/icons/user-plus";
  import X from "@lucide/svelte/icons/x";
  import { useApp } from "../lib/context.js";
  import { DIMENSION_LABELS, executeOperation } from "../lib/operations.js";
  import { checkCoordinate, checkReason } from "../lib/validate.js";
  import Avatar from "./Avatar.svelte";
  import DimensionPicker from "./DimensionPicker.svelte";
  import GameModePicker from "./GameModePicker.svelte";

  const app = useApp();
  const { session, ui, prefs, confirmer } = app;

  const name = ui.drawerPlayer;
  const online = $derived(session.isOnline(name));
  const ready = $derived(session.status === "connected" && !session.pending);
  const onlineReady = $derived(ready && online);
  const others = $derived(session.players.filter((player) => player.toLowerCase() !== name.toLowerCase()));
  const busy = (type) => session.pending?.type === type;

  let tpMode = $state("coords");
  let target = $state("");
  let dimension = $state("overworld");
  let x = $state(null);
  let y = $state(null);
  let z = $state(null);
  let reason = $state("");
  let coordsError = $state("");
  let targetError = $state("");
  let reasonError = $state("");

  const run = (action) => executeOperation(app, action);

  function teleportToCoords() {
    if (![x, y, z].every((value) => checkCoordinate(value).ok)) {
      coordsError = "请输入世界边界内的坐标（±29,999,984）";
      return;
    }
    coordsError = "";
    run({ type: "teleportToCoords", player: name, dimension, x, y, z });
  }

  function teleportToPlayer() {
    if (!target) {
      targetError = "请选择目标玩家";
      return;
    }
    targetError = "";
    run({ type: "teleportToPlayer", player: name, target });
  }

  function manage(type) {
    const checked = checkReason(reason);
    if (!checked.ok) {
      reasonError = checked.error;
      return;
    }
    reasonError = "";
    if (type === "banIp") run({ type, target: name, reason: checked.value });
    else run({ type, player: name, reason: checked.value });
  }

  function onkeydown(event) {
    if (event.key === "Escape" && !confirmer.request) ui.closeDrawer();
  }
</script>

<svelte:window {onkeydown} />

<aside class="drawer" aria-label="玩家操作">
  <header class="dh" role="group" aria-label="玩家信息">
    <Avatar {name} size={54} real={prefs.realAvatars} />
    <div>
      <div class="nm">{name}</div>
      <div class="st" class:off={!online}><span class="dot"></span>{online ? "在线" : "离线"}</div>
    </div>
    <button class="btn ghost icon x" type="button" aria-label="关闭" onclick={() => ui.closeDrawer()}>
      <X size={16} strokeWidth={1.8} />
    </button>
  </header>

  <section class="sec">
    <div class="t">传送 {#if !online}<span class="off-note">玩家不在线</span>{/if}</div>
    <div class="seg" role="tablist">
      <button type="button" role="tab" aria-selected={tpMode === "player"} class:on={tpMode === "player"} onclick={() => (tpMode = "player")}>到玩家</button>
      <button type="button" role="tab" aria-selected={tpMode === "coords"} class:on={tpMode === "coords"} onclick={() => (tpMode = "coords")}>到坐标</button>
    </div>
    {#if tpMode === "player"}
      <select class="input" bind:value={target} aria-label="目标玩家" disabled={!onlineReady}>
        <option value="">选择目标玩家…</option>
        {#each others as other (other)}<option value={other}>{other}</option>{/each}
      </select>
      {#if targetError}<span class="field-error">{targetError}</span>{/if}
      <button class="btn primary full" type="button" disabled={!onlineReady} onclick={teleportToPlayer}>
        {#if busy("teleportToPlayer")}<LoaderCircle size={15} class="spin" />{:else}<Navigation size={15} strokeWidth={1.8} />{/if}
        传送到 {target || "…"}
      </button>
    {:else}
      <DimensionPicker bind:value={dimension} disabled={!onlineReady} />
      <div class="xyz">
        <label class="fld"><em>X</em><input type="number" step="any" aria-label="X" bind:value={x} disabled={!onlineReady} /></label>
        <label class="fld"><em>Y</em><input type="number" step="any" aria-label="Y" bind:value={y} disabled={!onlineReady} /></label>
        <label class="fld"><em>Z</em><input type="number" step="any" aria-label="Z" bind:value={z} disabled={!onlineReady} /></label>
      </div>
      {#if coordsError}<span class="field-error">{coordsError}</span>{/if}
      <button class="btn primary full" type="button" disabled={!onlineReady} onclick={teleportToCoords}>
        {#if busy("teleportToCoords")}<LoaderCircle size={15} class="spin" />{:else}<Navigation size={15} strokeWidth={1.8} />{/if}
        传送到{DIMENSION_LABELS[dimension]}
        <small class="mono">{x ?? "X"}, {y ?? "Y"}, {z ?? "Z"}</small>
      </button>
    {/if}
  </section>

  <section class="sec">
    <div class="t">游戏模式 {#if !online}<span class="off-note">玩家不在线</span>{:else}<span class="aside">执行前确认</span>{/if}</div>
    <GameModePicker
      disabled={!onlineReady}
      pending={busy("setGameMode") ? session.pending.mode : null}
      onpick={(mode) => run({ type: "setGameMode", player: name, mode })}
    />
  </section>

  <section class="sec">
    <div class="t">白名单</div>
    <div class="row">
      <button class="btn ghost" type="button" disabled={!ready} onclick={() => run({ type: "whitelistAdd", player: name })}>
        <UserPlus size={15} strokeWidth={1.8} />加入白名单
      </button>
      <button class="btn ghost" type="button" disabled={!ready} onclick={() => run({ type: "whitelistRemove", player: name })}>
        <UserMinus size={15} strokeWidth={1.8} />移出白名单
      </button>
    </div>
  </section>

  <section class="danger">
    <div class="t">管理操作</div>
    <label class="field">
      <span class="sr-only">原因</span>
      <input
        class="input"
        bind:value={reason}
        maxlength="200"
        placeholder="原因（可选，会显示给该玩家）"
        aria-label="原因"
        aria-invalid={Boolean(reasonError)}
        disabled={!ready}
      />
      {#if reasonError}<span class="field-error">{reasonError}</span>{/if}
    </label>
    <div class="drow">
      <button class="btn warn" type="button" disabled={!onlineReady} onclick={() => manage("kick")}>
        {#if busy("kick")}<LoaderCircle size={14} class="spin" />{:else}<LogOut size={14} strokeWidth={1.8} />{/if}踢出
      </button>
      <button class="btn bad solid" type="button" disabled={!ready} onclick={() => manage("ban")}>
        {#if busy("ban")}<LoaderCircle size={14} class="spin" />{:else}<Ban size={14} strokeWidth={1.8} />{/if}封禁
      </button>
      <button class="btn bad" type="button" disabled={!onlineReady} onclick={() => manage("banIp")}>
        {#if busy("banIp")}<LoaderCircle size={14} class="spin" />{:else}<Globe size={14} strokeWidth={1.8} />{/if}封 IP
      </button>
    </div>
    <p class="hint">
      {#if online}每项都会先弹窗确认。封 IP 会影响同一网络下的所有人。{:else}玩家不在线：只能封禁或调整白名单。{/if}
    </p>
  </section>
</aside>

<style>
  .drawer {
    background: linear-gradient(180deg, rgba(14, 25, 30, 0.97), rgba(11, 20, 24, 0.98));
    border-left: 1px solid var(--line-2);
    padding: 22px 20px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    overflow-y: auto;
    box-shadow: -24px 0 48px -24px rgba(0, 0, 0, 0.7);
    animation: slide-in 0.2s ease-out;
  }
  @keyframes slide-in {
    from {
      transform: translateX(24px);
      opacity: 0;
    }
  }
  .dh {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .nm {
    font-family: var(--display);
    font-size: 20px;
    font-weight: 700;
  }
  .st {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--mint);
    margin-top: 2px;
  }
  .st.off {
    color: var(--text-3);
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }
  .x {
    margin-left: auto;
    align-self: flex-start;
  }
  .sec,
  .danger {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .t {
    font-size: 11px;
    letter-spacing: 0.16em;
    color: var(--text-3);
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .off-note,
  .aside {
    letter-spacing: 0;
    font-weight: 500;
  }
  .off-note {
    color: var(--amber);
  }
  .seg {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid var(--line);
    border-radius: 11px;
    padding: 3px;
  }
  .seg button {
    border: 0;
    background: transparent;
    padding: 7px 0;
    border-radius: 8px;
    font-size: 12.5px;
    color: var(--text-2);
  }
  .seg button.on {
    background: var(--card-hi);
    color: var(--text);
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06) inset, 0 4px 10px -6px rgba(0, 0, 0, 0.8);
  }
  .xyz {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .fld {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid var(--line-2);
    border-radius: 10px;
    padding: 0 10px;
    height: 38px;
  }
  .fld:focus-within {
    border-color: rgba(142, 230, 190, 0.45);
  }
  .fld em {
    font-style: normal;
    font-size: 11px;
    font-weight: 700;
    color: var(--text-3);
  }
  .fld input {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    font-family: var(--mono);
    font-size: 13px;
    appearance: textfield;
  }
  small {
    font-weight: 500;
    opacity: 0.7;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .danger {
    border: 1px solid rgba(255, 143, 126, 0.16);
    background: linear-gradient(180deg, rgba(255, 143, 126, 0.06), rgba(255, 143, 126, 0.015));
    border-radius: 13px;
    padding: 12px;
    margin-top: auto;
  }
  .danger .t {
    color: #e0a79d;
  }
  .drow {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .drow .btn {
    height: 34px;
    font-size: 12.5px;
  }
  .hint {
    font-size: 11.5px;
    color: var(--text-3);
    line-height: 1.5;
  }
</style>
