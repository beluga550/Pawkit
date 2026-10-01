<script>
  import { checkPlayer } from "../lib/validate.js";

  let { onopen, oncancel } = $props();
  let name = $state("");
  let error = $state("");
  let input;

  $effect(() => input.focus());

  function submit(event) {
    event.preventDefault();
    const checked = checkPlayer(name.trim());
    if (!checked.ok) {
      error = checked.error;
      return;
    }
    onopen(checked.value);
  }
</script>

<form class="lookup panel" onsubmit={submit} novalidate>
  <label class="field grow">
    <span class="sr-only">玩家名</span>
    <input
      bind:this={input}
      class="input mono"
      bind:value={name}
      maxlength="16"
      placeholder="输入 Java 版玩家名，例如 Steve"
      aria-label="玩家名"
      aria-invalid={Boolean(error)}
    />
    {#if error}<span class="field-error">{error}</span>{/if}
  </label>
  <button class="btn primary" type="submit">打开</button>
  <button class="btn ghost" type="button" onclick={oncancel}>取消</button>
</form>

<style>
  .lookup {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }
  .grow {
    flex: 1;
  }
</style>
