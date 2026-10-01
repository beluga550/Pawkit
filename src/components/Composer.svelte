<script>
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import Megaphone from "@lucide/svelte/icons/megaphone";
  import Send from "@lucide/svelte/icons/send";
  import { useApp } from "../lib/context.js";
  import { executeOperation } from "../lib/operations.js";
  import { charCount, checkMessage, MESSAGE_MAX } from "../lib/validate.js";

  const app = useApp();
  const { session } = app;

  let text = $state("");
  let error = $state("");
  const count = $derived(charCount(text.trim()));
  const sending = $derived(session.pending?.type === "broadcast");
  const disabled = $derived(session.status !== "connected" || Boolean(session.pending));

  async function send(event) {
    event.preventDefault();
    const checked = checkMessage(text);
    if (!checked.ok) {
      error = checked.error;
      return;
    }
    error = "";
    const result = await executeOperation(app, { type: "broadcast", message: checked.value });
    if (result.ok) text = "";
  }
</script>

<form class="composer-wrap" onsubmit={send} novalidate>
  <div class="composer" class:invalid={Boolean(error)}>
    <Megaphone size={18} strokeWidth={1.8} class="ic" />
    <input
      class="text"
      bind:value={text}
      placeholder="向全服发送一条广播…"
      aria-label="广播内容"
      aria-invalid={Boolean(error)}
      oninput={() => (error = "")}
    />
    <span class="ctr mono" class:over={count > MESSAGE_MAX}>{count} / {MESSAGE_MAX}</span>
    <button class="btn primary" type="submit" {disabled}>
      {#if sending}<LoaderCircle size={15} class="spin" />{:else}<Send size={15} strokeWidth={1.8} />{/if}
      发送
    </button>
  </div>
  {#if error}<p class="field-error">{error}</p>{/if}
</form>

<style>
  .composer {
    display: flex;
    align-items: center;
    gap: 12px;
    background: linear-gradient(180deg, var(--card-hi), var(--card));
    border: 1px solid var(--line-2);
    border-radius: 14px;
    padding: 7px 7px 7px 16px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .composer:hover,
  .composer:focus-within {
    border-color: rgba(142, 230, 190, 0.35);
    box-shadow: 0 0 0 4px var(--mint-glow);
  }
  .composer.invalid {
    border-color: rgba(255, 143, 126, 0.55);
  }
  .composer :global(.ic) {
    color: var(--mint);
  }
  .text {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    font-size: 13.5px;
  }
  .text::placeholder {
    color: var(--text-3);
  }
  .ctr {
    font-size: 11px;
    color: var(--text-3);
  }
  .ctr.over {
    color: var(--coral);
  }
  .field-error {
    margin: 6px 0 0 16px;
  }
</style>
