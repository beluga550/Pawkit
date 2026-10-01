<script>
  let { output, label = "服务器原文" } = $props();
</script>

<details class="raw">
  <summary>{label}</summary>
  <pre>{output || "（服务器没有返回文字）"}</pre>
</details>

<style>
  .raw {
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: rgba(0, 0, 0, 0.2);
  }
  summary {
    cursor: pointer;
    padding: 8px 12px;
    font-size: 12px;
    color: var(--text-3);
  }
  pre {
    padding: 0 12px 10px;
    font: 11.5px/1.6 var(--mono);
    color: var(--text-2);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
