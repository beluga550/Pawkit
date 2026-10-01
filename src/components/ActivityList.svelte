<script>
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import CircleX from "@lucide/svelte/icons/circle-x";
  import { useApp } from "../lib/context.js";
  import { STATUS_LABELS } from "../lib/history.svelte.js";

  let { entries, detailed = false } = $props();
  const { toasts } = useApp();

  const TAGS = { returned: ["ok", CircleCheck], unknown: ["unk", CircleAlert], error: ["err", CircleX] };

  function time(entry) {
    return new Date(entry.at).toLocaleTimeString("zh-CN", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: detailed ? "2-digit" : undefined,
    });
  }

  async function copy(entry) {
    const text = `${time(entry)} ${entry.action}\n${entry.output}`;
    try {
      await navigator.clipboard.writeText(text);
      toasts.push({ tone: "info", title: "已复制这条记录" });
    } catch {
      toasts.push({ tone: "error", title: "复制失败", detail: "请手动选中记录文字复制。" });
    }
  }
</script>

{#if entries.length === 0}
  <p class="empty">今天还没有操作记录。</p>
{:else}
  <ul class:detailed>
    {#each entries as entry (entry.at + entry.action)}
      {@const [tone, Icon] = TAGS[entry.status] ?? TAGS.error}
      <li class="log">
        <time class="mono">{time(entry)}</time>
        <div class="body">
          <span class="what">{entry.action}</span>
          {#if detailed}<pre>{entry.output || "（服务器没有返回文字）"}</pre>{/if}
        </div>
        <span class="tag {tone}"><Icon size={12} strokeWidth={2} />{STATUS_LABELS[entry.status] ?? entry.status}</span>
        {#if detailed}
          <button class="btn ghost copy" type="button" onclick={() => copy(entry)}>复制</button>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  ul {
    list-style: none;
    padding: 0;
  }
  .log {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    border-top: 1px solid var(--line);
    font-size: 13px;
  }
  .detailed .log {
    grid-template-columns: 76px minmax(0, 1fr) auto auto;
    align-items: start;
    padding: 12px 0;
  }
  .log:first-child {
    border-top: 0;
  }
  time {
    font-size: 11.5px;
    color: var(--text-3);
  }
  .what {
    display: block;
    color: var(--text-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .detailed .what {
    white-space: normal;
    color: var(--text);
  }
  pre {
    margin-top: 6px;
    font: 11.5px/1.5 var(--mono);
    color: var(--text-3);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .copy {
    height: 28px;
    font-size: 12px;
  }
  .empty {
    color: var(--text-3);
    font-size: 12.5px;
    padding: 6px 0;
  }
</style>
