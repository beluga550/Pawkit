import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createToasts } from "./toasts.svelte.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("auto-dismisses replied results after 5 seconds", () => {
  const toasts = createToasts();
  toasts.push({ tone: "ok", title: "服务器已回复", detail: "Kicked Steve" });
  vi.advanceTimersByTime(4999);
  expect(toasts.items).toHaveLength(1);
  vi.advanceTimersByTime(1);
  expect(toasts.items).toHaveLength(0);
});

it("keeps unknown-result toasts until dismissed", () => {
  const toasts = createToasts();
  const id = toasts.push({ tone: "unknown", title: "结果未知" });
  vi.advanceTimersByTime(60_000);
  expect(toasts.items).toHaveLength(1);
  toasts.dismiss(id);
  expect(toasts.items).toHaveLength(0);
});

it("keeps at most five toasts", () => {
  const toasts = createToasts();
  for (let index = 0; index < 7; index += 1) toasts.push({ tone: "unknown", title: `t${index}` });
  expect(toasts.items.map((toast) => toast.title)).toEqual(["t2", "t3", "t4", "t5", "t6"]);
});

it("never evicts an unknown-result toast to make room", () => {
  const toasts = createToasts();
  toasts.push({ tone: "unknown", title: "结果未知 · 踢出 Steve" });
  for (let index = 0; index < 6; index += 1) toasts.push({ tone: "ok", title: `ok${index}` });
  expect(toasts.items).toHaveLength(5);
  expect(toasts.items[0].title).toBe("结果未知 · 踢出 Steve");
});
