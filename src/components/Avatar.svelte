<script>
  import { avatarFor } from "../lib/avatar.js";
  import { isPlayerName } from "../lib/validate.js";

  let { name, size = 42, real = true } = $props();

  const look = $derived(avatarFor(name));
  const remote = $derived(real && isPlayerName(name) ? `https://mc-heads.net/avatar/${name}/64` : null);
  let loadedSrc = $state(null);
</script>

<span class="avatar" style:--size={`${size}px`} aria-hidden="true">
  <svg viewBox="0 0 8 8" shape-rendering="crispEdges">
    <rect width="8" height="8" fill={look.skin} />
    {#each look.hairRects as [x, y, w, h], index (index)}
      <rect {x} {y} width={w} height={h} fill={look.hair} />
    {/each}
    <rect x="1" y="4" width="1" height="1" fill="#ffffff" />
    <rect x="2" y="4" width="1" height="1" fill={look.eye} />
    <rect x="5" y="4" width="1" height="1" fill={look.eye} />
    <rect x="6" y="4" width="1" height="1" fill="#ffffff" />
    <rect x="3" y="5" width="2" height="1" fill={look.shade} />
    <rect x="2" y="6" width="4" height="1" fill={look.mouth} />
  </svg>
  {#if remote}
    <img
      src={remote}
      alt=""
      class:loaded={loadedSrc === remote}
      onload={(event) => (loadedSrc = event.currentTarget.getAttribute("src"))}
    />
  {/if}
</span>

<style>
  .avatar {
    position: relative;
    display: inline-block;
    flex-shrink: 0;
    width: var(--size);
    height: var(--size);
    border-radius: calc(var(--size) * 0.24);
    overflow: hidden;
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08), 0 6px 14px -8px rgba(0, 0, 0, 0.9);
  }
  svg,
  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }
  img {
    opacity: 0;
    transition: opacity 0.25s;
  }
  img.loaded {
    opacity: 1;
  }
</style>
