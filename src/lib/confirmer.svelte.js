/** One pending confirmation at a time. `ask` resolves true only on an explicit confirm. */
export function createConfirmer() {
  let request = $state.raw(null);

  function answer(confirmed) {
    const current = request;
    if (!current) return;
    request = null;
    current.resolve(confirmed);
  }

  return {
    get request() {
      return request;
    },
    ask(options) {
      answer(false);
      return new Promise((resolve) => {
        request = { ...options, resolve };
      });
    },
    answer,
  };
}
