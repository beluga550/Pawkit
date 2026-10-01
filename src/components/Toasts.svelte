<script>
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import Info from "@lucide/svelte/icons/info";
  import X from "@lucide/svelte/icons/x";

  let { toasts } = $props();
  const ICONS = { ok: CircleCheck, info: Info, unknown: CircleAlert, error: CircleAlert };
</script>

<div class="stack" role="status" aria-live="polite">
  {#each toasts.items as toast (toast.id)}
    {@const Icon = ICONS[toast.tone]}
    <div class="toast {toast.tone}">
      <Icon size={18} strokeWidth={1.8} />
      <div class="body">
        <strong>{toast.title}</strong>
        {#if toast.detail}<pre>{toast.detail}</pre>{/if}
      </div>
      <button class="close" type="button" aria-label="关闭通知" onclick={() => toasts.dismiss(toast.id)}>
        <X size={16} strokeWidth={1.8} />
      </button>
    </div>
  {/each}
</div>

<style>
  .stack {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: min(380px, calc(100vw - 40px));
    pointer-events: none;
  }
  .toast {
    pointer-events: auto;
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid var(--line-2);
    background: linear-gradient(180deg, var(--card-hi), var(--card));
    box-shadow: 0 20px 40px -20px rgba(0, 0, 0, 0.9);
    animation: rise 0.2s ease-out;
  }
  .ok,
  .info {
    color: var(--mint);
  }
  .unknown {
    color: var(--amber);
    border-color: rgba(243, 197, 110, 0.4);
  }
  .error {
    color: var(--coral);
    border-color: rgba(255, 143, 126, 0.35);
  }
  .body {
    flex: 1;
    min-width: 0;
  }
  strong {
    display: block;
    color: var(--text);
    font-size: 13px;
  }
  pre {
    margin-top: 4px;
    font: 11.5px/1.5 var(--mono);
    color: var(--text-2);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    max-height: 120px;
    overflow: auto;
  }
  .close {
    border: 0;
    background: transparent;
    color: var(--text-3);
    padding: 2px;
    border-radius: 6px;
  }
  .close:hover {
    color: var(--text);
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }
</style>
