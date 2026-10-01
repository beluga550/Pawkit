<script>
  import { tick } from "svelte";
  import CircleAlert from "@lucide/svelte/icons/circle-alert";

  let { confirmer } = $props();

  let dialog;
  let cancelButton = $state();
  let confirmButton = $state();

  const request = $derived(confirmer.request);
  const danger = $derived(request?.level === "danger");

  $effect(() => {
    if (request && !dialog.open) {
      dialog.showModal();
      tick().then(() => (danger ? cancelButton : confirmButton)?.focus());
    } else if (!request && dialog.open) {
      dialog.close();
    }
  });

  function onkeydown(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    // Normal: Enter confirms. Danger: Enter always cancels.
    confirmer.answer(!danger);
  }

  function onConfirmClick(event) {
    // A dangerous action needs a real pointer click; keyboard activation has detail 0.
    if (danger && event.detail === 0) return;
    confirmer.answer(true);
  }

  function oncancel(event) {
    event.preventDefault();
    confirmer.answer(false);
  }
</script>

<dialog bind:this={dialog} class:danger {onkeydown} {oncancel} aria-labelledby="confirm-title">
  {#if request}
    <div class="head">
      {#if danger}<CircleAlert size={20} strokeWidth={1.8} />{/if}
      <h2 id="confirm-title">{request.title}</h2>
    </div>
    <p class="summary">{request.summary}</p>
    {#if request.detail}<p class="detail">{request.detail}</p>{/if}
    {#if request.consequence}<p class="consequence">{request.consequence}</p>{/if}
    {#if danger}<p class="hint">请用鼠标点击“{request.confirmLabel}”；按回车会取消。</p>{/if}
    <div class="actions">
      <button bind:this={cancelButton} class="btn ghost" type="button" onclick={() => confirmer.answer(false)}>取消</button>
      <button
        bind:this={confirmButton}
        class="btn"
        class:primary={!danger}
        class:bad={danger}
        class:solid={danger}
        type="button"
        onclick={onConfirmClick}
      >
        {request.confirmLabel}
      </button>
    </div>
  {/if}
</dialog>

<style>
  dialog {
    /* base.css resets margins; modal dialogs need auto margins to center. */
    margin: auto;
    width: min(440px, calc(100vw - 32px));
    padding: 22px;
    border-radius: 16px;
    border: 1px solid var(--line-2);
    background: linear-gradient(180deg, var(--card-hi), var(--card));
    color: var(--text);
    box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.8);
  }
  dialog::backdrop {
    background: rgba(3, 7, 10, 0.72);
  }
  dialog.danger {
    border-color: rgba(255, 143, 126, 0.35);
    background: linear-gradient(180deg, #2a1a19, #1d1414);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--coral);
  }
  h2 {
    font-family: var(--display);
    font-size: 19px;
    color: var(--text);
  }
  .summary {
    margin-top: 12px;
    font-size: 14px;
    line-height: 1.6;
  }
  .detail,
  .hint {
    margin-top: 6px;
    font-size: 12.5px;
    color: var(--text-3);
  }
  .consequence {
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: var(--radius-control);
    background: rgba(255, 143, 126, 0.08);
    color: #ffb4a8;
    line-height: 1.5;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 22px;
  }
</style>
