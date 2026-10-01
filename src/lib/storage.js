/** JSON over localStorage. A failed write is reported once per app run. */
export function createStorage(backend = globalThis.localStorage, { onWriteError = () => {} } = {}) {
  let warned = false;
  return {
    read(key, fallback) {
      try {
        const raw = backend.getItem(key);
        return raw === null ? fallback : (JSON.parse(raw) ?? fallback);
      } catch {
        return fallback;
      }
    },
    write(key, value) {
      try {
        backend.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        if (!warned) {
          warned = true;
          onWriteError();
        }
        return false;
      }
    },
  };
}
