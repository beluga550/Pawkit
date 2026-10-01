import { expect, it, vi } from "vitest";
import { createStorage } from "./storage.js";
import { failingBackend, memoryBackend } from "../test-utils.js";

it("round-trips JSON values", () => {
  const storage = createStorage(memoryBackend());
  expect(storage.write("k", { a: 1 })).toBe(true);
  expect(storage.read("k", null)).toEqual({ a: 1 });
});

it("falls back on missing or corrupt values", () => {
  const storage = createStorage(memoryBackend({ bad: "{not json" }));
  expect(storage.read("missing", [])).toEqual([]);
  expect(storage.read("bad", [])).toEqual([]);
});

it("reports a write failure only once", () => {
  const onWriteError = vi.fn();
  const storage = createStorage(failingBackend(), { onWriteError });
  expect(storage.write("k", 1)).toBe(false);
  expect(storage.write("k", 2)).toBe(false);
  expect(onWriteError).toHaveBeenCalledOnce();
});
