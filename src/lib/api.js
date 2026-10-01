import { invoke } from "@tauri-apps/api/core";

/** The only path to the Rust backend. Tests and the browser preview swap in a fake. */
export const tauriApi = {
  connect: (profile, password) => invoke("connect_rcon", { profile, password }),
  reconnect: () => invoke("reconnect_rcon"),
  disconnect: () => invoke("disconnect_rcon"),
  query: (query) => invoke("query", { query }),
  perform: (action) => invoke("perform", { action }),
};

export function errorInfo(error) {
  if (error && typeof error === "object" && typeof error.kind === "string" && typeof error.message === "string") {
    return { kind: error.kind, message: error.message };
  }
  const message = error instanceof Error ? error.message : String(error ?? "未知错误");
  return { kind: "internal", message };
}
