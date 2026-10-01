/** In-memory stand-in for localStorage. `map` exposes the raw stored strings. */
export function memoryBackend(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
}

export function failingBackend() {
  return {
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
}
