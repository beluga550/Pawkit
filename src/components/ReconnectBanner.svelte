<script>
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import WifiOff from "@lucide/svelte/icons/wifi-off";
  import { useApp } from "../lib/context.js";

  const { session } = useApp();
</script>

<div class="banner" role="alert">
  <WifiOff size={18} strokeWidth={1.8} />
  <span>连接中断，正在每 15 秒自动重试。操作按钮已暂时停用，已发出的操作不会自动重发。</span>
  <button class="btn ghost" type="button" disabled={session.reconnectBusy} onclick={() => session.reconnect()}>
    {#if session.reconnectBusy}<LoaderCircle size={15} class="spin" />{/if}
    立即重连
  </button>
</div>

<style>
  .banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px 10px 16px;
    border-radius: var(--radius);
    border: 1px solid rgba(243, 197, 110, 0.3);
    background: rgba(243, 197, 110, 0.08);
    color: var(--amber);
    font-size: 13px;
  }
  span {
    flex: 1;
  }
</style>
