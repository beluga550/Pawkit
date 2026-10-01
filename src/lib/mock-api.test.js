import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createMockApi } from "./mock-api.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function call(promise) {
  await vi.runAllTimersAsync();
  return promise;
}

it("has the same shape as the real api", () => {
  const api = createMockApi();
  for (const name of ["connect", "reconnect", "disconnect", "query", "perform"]) expect(typeof api[name]).toBe("function");
});

it("kicking removes the player from the next list", async () => {
  const api = createMockApi();
  await call(api.perform({ type: "kick", player: "steve", reason: null }));
  const list = await call(api.query({ type: "onlinePlayers" }));
  expect(list.players).not.toContain("Steve");
});

it("rejects the password 'wrong'", async () => {
  const api = createMockApi();
  const attempt = api.connect({}, "wrong");
  const outcome = expect(attempt).rejects.toMatchObject({ kind: "disconnected" });
  await vi.runAllTimersAsync();
  await outcome;
});
