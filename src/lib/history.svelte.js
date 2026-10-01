export const HISTORY_KEY = "pawkit.history.v1";
export const STATUS_LABELS = { returned: "服务器已回复", unknown: "结果未知", error: "未执行" };

export function localDate(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function isEntry(entry) {
  return Boolean(entry) && typeof entry.date === "string" && typeof entry.action === "string";
}

/** Today's activity log. Only the current local date is kept. */
export function createHistory({ storage, now = () => new Date() }) {
  const saved = storage.read(HISTORY_KEY, []);
  let entries = $state(Array.isArray(saved) ? saved.filter(isEntry) : []);

  function save() {
    storage.write(HISTORY_KEY, $state.snapshot(entries));
  }

  function prune() {
    const today = localDate(now());
    const kept = entries.filter((entry) => entry.date === today);
    if (kept.length !== entries.length) {
      entries = kept;
      save();
    }
  }

  prune();

  return {
    get entries() {
      return entries;
    },
    recent(count) {
      return entries.slice(-count).reverse();
    },
    record(action, status, output) {
      prune();
      const at = now();
      entries = [...entries, { date: localDate(at), at: at.toISOString(), action, status, output: output ?? "" }];
      save();
    },
    prune,
  };
}
