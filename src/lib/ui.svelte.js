export const PAGES = ["players", "bans", "whitelist", "history"];

/** Which page is shown and which player the action drawer is open for. */
export function createUi() {
  let page = $state("players");
  let drawerPlayer = $state(null);
  return {
    get page() {
      return page;
    },
    go(next) {
      if (PAGES.includes(next)) page = next;
    },
    get drawerPlayer() {
      return drawerPlayer;
    },
    openPlayer(name) {
      drawerPlayer = name;
    },
    closeDrawer() {
      drawerPlayer = null;
    },
  };
}
