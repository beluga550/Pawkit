<script>
  import { DIMENSION_LABELS } from "../lib/operations.js";

  let { value = $bindable("overworld"), disabled = false } = $props();
</script>

<div class="dims" role="radiogroup" aria-label="维度">
  {#each Object.entries(DIMENSION_LABELS) as [key, label] (key)}
    <button
      type="button"
      role="radio"
      aria-checked={value === key}
      class="dim {key}"
      class:on={value === key}
      {disabled}
      onclick={() => (value = key)}
    >
      <i aria-hidden="true"></i>{label}
    </button>
  {/each}
</div>

<style>
  .dims {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .dim {
    border-radius: 11px;
    padding: 10px 8px 9px;
    text-align: center;
    font-size: 12.5px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.02);
    color: var(--text-2);
    transition: border-color 0.15s, background 0.15s, color 0.15s;
  }
  .dim:disabled {
    opacity: 0.45;
  }
  i {
    display: block;
    width: 22px;
    height: 22px;
    margin: 0 auto 6px;
    border-radius: 6px;
  }
  .overworld i {
    background: linear-gradient(180deg, var(--over) 0 40%, #7a5536 40%);
  }
  .nether i {
    background: linear-gradient(135deg, var(--nether), #8e1d1d);
  }
  .end i {
    background: radial-gradient(circle at 50% 45%, #1a0f2b 28%, #e9e3b4 30% 48%, var(--end) 50%);
  }
  .dim.on {
    color: var(--text);
  }
  .overworld.on {
    border-color: color-mix(in srgb, var(--over) 55%, transparent);
    background: linear-gradient(180deg, color-mix(in srgb, var(--over) 14%, transparent), transparent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--over) 10%, transparent);
  }
  .nether.on {
    border-color: color-mix(in srgb, var(--nether) 55%, transparent);
    background: linear-gradient(180deg, color-mix(in srgb, var(--nether) 14%, transparent), transparent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--nether) 10%, transparent);
  }
  .end.on {
    border-color: color-mix(in srgb, var(--end) 55%, transparent);
    background: linear-gradient(180deg, color-mix(in srgb, var(--end) 14%, transparent), transparent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--end) 10%, transparent);
  }
</style>
