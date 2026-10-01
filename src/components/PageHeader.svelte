<script>
  let { kicker, title, sub = "", aside, actions } = $props();
</script>

<header class="head">
  <div>
    <div class="kicker">{kicker}</div>
    <h1>{title}{#if aside}<span class="aside">{@render aside()}</span>{/if}</h1>
    {#if sub}<p class="sub">{sub}</p>{/if}
  </div>
  {#if actions}<div class="actions">{@render actions()}</div>{/if}
</header>

<style>
  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
  }
  h1 {
    font-family: var(--display);
    font-size: 28px;
    font-weight: 700;
    margin-top: 4px;
    display: flex;
    align-items: baseline;
    gap: 12px;
  }
  .aside {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-3);
    font-variant-numeric: tabular-nums;
  }
  .sub {
    color: var(--text-3);
    font-size: 12.5px;
    margin-top: 4px;
  }
  .actions {
    display: flex;
    gap: 8px;
  }
</style>
