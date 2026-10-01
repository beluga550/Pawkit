<script>
  import ActivityList from "../components/ActivityList.svelte";
  import PageHeader from "../components/PageHeader.svelte";
  import { useApp } from "../lib/context.js";

  const { history } = useApp();
  const newestFirst = $derived([...history.entries].reverse());
</script>

<PageHeader kicker="ACTIVITY" title="今日记录" sub="只保存在这台电脑上，跨过午夜自动清空">
  {#snippet aside()}{history.entries.length} 条{/snippet}
</PageHeader>

<section class="panel">
  <ActivityList entries={newestFirst} detailed />
</section>
