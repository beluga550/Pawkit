import { getContext, setContext } from "svelte";

const KEY = Symbol("pawkit");

export const setApp = (app) => setContext(KEY, app);
export const useApp = () => getContext(KEY);
/** For tests: `render(Component, { props, context: appContext(app) })`. */
export const appContext = (app) => new Map([[KEY, app]]);
