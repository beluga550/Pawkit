<script>
  import Box from "@lucide/svelte/icons/box";
  import Compass from "@lucide/svelte/icons/compass";
  import Eye from "@lucide/svelte/icons/eye";
  import Heart from "@lucide/svelte/icons/heart";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import { MODE_LABELS } from "../lib/operations.js";

  let { onpick, disabled = false, pending = null } = $props();
  const ICONS = { survival: Heart, creative: Box, adventure: Compass, spectator: Eye };
</script>

<div class="modes">
  {#each Object.entries(MODE_LABELS) as [mode, label] (mode)}
    {@const Icon = ICONS[mode]}
    <button type="button" class="mode" {disabled} onclick={() => onpick(mode)}>
      {#if pending === mode}<LoaderCircle size={18} class="spin" />{:else}<Icon size={18} strokeWidth={1.8} />{/if}
      {label}
    </button>
  {/each}
</div>

<style>
  .modes {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  .mode {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px 0 9px;
    border-radius: 11px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.02);
    font-size: 12px;
    color: var(--text-2);
    transition: border-color 0.15s, background 0.15s, color 0.15s;
  }
  .mode:hover:not(:disabled) {
    border-color: var(--line-2);
    background: rgba(255, 255, 255, 0.05);
    color: var(--text);
  }
  .mode:disabled {
    opacity: 0.45;
  }
</style>
