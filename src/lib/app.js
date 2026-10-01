import { createConfirmer } from "./confirmer.svelte.js";
import { createHistory } from "./history.svelte.js";
import { createPrefs } from "./prefs.svelte.js";
import { createSession } from "./session.svelte.js";
import { createStorage } from "./storage.js";
import { createToasts } from "./toasts.svelte.js";
import { createUi } from "./ui.svelte.js";

export function createApp({ api, backend = globalThis.localStorage, timers = globalThis, now = () => new Date() }) {
  const toasts = createToasts({ timers });
  const storage = createStorage(backend, {
    onWriteError: () =>
      toasts.push({ tone: "error", title: "无法保存本地记录", detail: "这台电脑无法写入应用存储，请检查磁盘空间。" }),
  });
  const history = createHistory({ storage, now });
  const prefs = createPrefs({ storage });
  const session = createSession({ api, storage, history, toasts, timers, now });
  return { api, storage, history, toasts, prefs, session, confirmer: createConfirmer(), ui: createUi() };
}
