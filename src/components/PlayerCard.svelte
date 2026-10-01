<script>
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import Avatar from "./Avatar.svelte";

  let { name, selected = false, real = true, onclick } = $props();
</script>

<button type="button" class="pcard" class:sel={selected} aria-pressed={selected} {onclick}>
  <Avatar {name} {real} />
  <span class="text">
    <span class="nm">{name}</span>
    <span class="st"><span class="dot"></span>在线</span>
  </span>
  <EllipsisVertical size={18} strokeWidth={1.8} class="more" />
</button>

<style>
  .pcard {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: var(--radius);
    background: linear-gradient(180deg, var(--card-hi), var(--card));
    border: 1px solid var(--line);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
    text-align: left;
    transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
  }
  .pcard:hover {
    transform: translateY(-2px);
    border-color: var(--line-2);
    box-shadow: 0 12px 24px -16px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }
  .pcard.sel {
    border-color: rgba(142, 230, 190, 0.55);
    box-shadow: 0 0 0 4px var(--mint-glow), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }
  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .nm {
    font-weight: 650;
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .st {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11.5px;
    color: var(--text-3);
    margin-top: 2px;
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--mint);
  }
  .pcard :global(.more) {
    margin-left: auto;
    color: var(--text-3);
    opacity: 0;
    transition: opacity 0.15s;
  }
  .pcard:hover :global(.more),
  .pcard.sel :global(.more) {
    opacity: 1;
  }
</style>
