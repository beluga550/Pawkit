import { expect, it } from "vitest";
import { createHistory, HISTORY_KEY } from "./history.svelte.js";
import { createStorage } from "./storage.js";
import { memoryBackend } from "../test-utils.js";

function setup(start = new Date(2026, 9, 1, 19, 40)) {
  const backend = memoryBackend();
  const storage = createStorage(backend);
  const clock = { now: start };
  const history = createHistory({ storage, now: () => clock.now });
  return { backend, storage, clock, history };
}

it("records entries in the stored format", () => {
  const { backend, history } = setup();
  history.record("广播：hi", "returned", "Broadcast sent");
  expect(history.entries).toHaveLength(1);
  const [entry] = JSON.parse(backend.map.get(HISTORY_KEY));
  expect(entry).toMatchObject({ date: "2026-10-01", action: "广播：hi", status: "returned", output: "Broadcast sent" });
  expect(typeof entry.at).toBe("string");
});

it("returns the most recent entries first", () => {
  const { history } = setup();
  for (const name of ["a", "b", "c", "d"]) history.record(name, "returned", "");
  expect(history.recent(3).map((entry) => entry.action)).toEqual(["d", "c", "b"]);
});

it("prune drops entries from previous days", () => {
  const { clock, history } = setup();
  history.record("yesterday", "returned", "");
  clock.now = new Date(2026, 9, 2, 0, 0, 5);
  history.prune();
  expect(history.entries).toEqual([]);
});

it("loads today's saved entries and ignores corrupt data", () => {
  const today = { date: "2026-10-01", at: "2026-10-01T11:00:00.000Z", action: "x", status: "returned", output: "" };
  const old = { ...today, date: "2026-09-30" };
  const storage = createStorage(memoryBackend({ [HISTORY_KEY]: JSON.stringify([old, today, 42]) }));
  const history = createHistory({ storage, now: () => new Date(2026, 9, 1, 20) });
  expect(history.entries).toEqual([today]);

  const broken = createStorage(memoryBackend({ [HISTORY_KEY]: '{"not":"an array"}' }));
  expect(createHistory({ storage: broken }).entries).toEqual([]);
});
