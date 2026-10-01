import { fireEvent, screen } from "@testing-library/svelte";
import { afterEach, expect, it, vi } from "vitest";
import History from "./History.svelte";
import { renderInApp, settle, testApp } from "../test-utils.js";

afterEach(() => {
  delete navigator.clipboard;
});

function setup() {
  const app = testApp();
  app.history.record("广播：hi", "returned", "");
  app.history.record("踢出 Griefer99", "unknown", "命令可能已经送达");
  renderInApp(History, {}, app);
  return app;
}

it("lists every entry newest first with status and output", () => {
  setup();
  const rows = screen.getAllByRole("listitem");
  expect(rows[0]).toHaveTextContent("踢出 Griefer99");
  expect(rows[0]).toHaveTextContent("结果未知");
  expect(rows[0]).toHaveTextContent("命令可能已经送达");
  expect(rows[1]).toHaveTextContent("服务器已回复");
  expect(rows[1]).toHaveTextContent("（服务器没有返回文字）");
});

it("copies an entry", async () => {
  const writeText = vi.fn(async () => {});
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  const app = setup();
  await fireEvent.click(screen.getAllByRole("button", { name: "复制" })[0]);
  await settle();
  expect(writeText.mock.calls[0][0]).toContain("踢出 Griefer99\n命令可能已经送达");
  expect(app.toasts.items.at(-1).title).toBe("已复制这条记录");
});

it("shows an empty state", () => {
  renderInApp(History, {}, testApp());
  expect(screen.getByText("今天还没有操作记录。")).toBeInTheDocument();
});
