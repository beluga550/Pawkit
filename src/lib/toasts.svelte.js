const LIFETIME_MS = { ok: 5000, info: 5000, error: 8000 };
const MAX_TOASTS = 5;

/** Bottom-right notifications. "unknown" toasts stay until the user closes them. */
export function createToasts({ timers = globalThis } = {}) {
  let items = $state([]);
  let nextId = 1;

  function dismiss(id) {
    items = items.filter((toast) => toast.id !== id);
  }

  function push({ tone, title, detail = "" }) {
    const id = nextId++;
    const next = [...items, { id, tone, title, detail }];
    while (next.length > MAX_TOASTS) {
      // Drop the oldest toast that may disappear; "unknown" ones must stay until closed.
      const index = next.findIndex((toast) => toast.tone !== "unknown");
      next.splice(index === -1 ? 0 : index, 1);
    }
    items = next;
    const lifetime = LIFETIME_MS[tone];
    if (lifetime) timers.setTimeout(() => dismiss(id), lifetime);
    return id;
  }

  return {
    get items() {
      return items;
    },
    push,
    dismiss,
  };
}
