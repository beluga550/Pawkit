<script>
  import ConfirmDialog from "./components/ConfirmDialog.svelte";
  import Shell from "./components/Shell.svelte";
  import Toasts from "./components/Toasts.svelte";
  import { setApp } from "./lib/context.js";
  import Connect from "./pages/Connect.svelte";

  let { app } = $props();
  setApp(app);

  $effect(() => app.session.start());

  $effect(() => {
    if (app.session.status === "disconnected") {
      app.ui.closeDrawer();
      app.ui.go("players");
    }
  });
</script>

{#if app.session.status === "disconnected"}
  <Connect />
{:else}
  <Shell />
{/if}
<Toasts toasts={app.toasts} />
<ConfirmDialog confirmer={app.confirmer} />
