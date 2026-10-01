import { fireEvent, render, screen } from "@testing-library/svelte";
import { flushSync } from "svelte";
import { expect, it } from "vitest";
import { createConfirmer } from "../lib/confirmer.svelte.js";
import { settle } from "../test-utils.js";
import ConfirmDialog from "./ConfirmDialog.svelte";

const NORMAL = { level: "normal", title: "确认踢出", summary: "将 Steve 踢出服务器。", confirmLabel: "踢出" };
const DANGER = {
  level: "danger",
  title: "确认封禁",
  summary: "封禁 Steve。",
  consequence: "Steve 将无法再进入服务器，直到被解封。",
  confirmLabel: "封禁",
};

function open(options) {
  const confirmer = createConfirmer();
  render(ConfirmDialog, { confirmer });
  const answer = confirmer.ask(options);
  flushSync();
  return { confirmer, answer, dialog: document.querySelector("dialog") };
}

it("shows the request and confirms a normal action with Enter", async () => {
  const { answer, dialog } = open(NORMAL);
  expect(dialog.open).toBe(true);
  expect(screen.getByText("将 Steve 踢出服务器。")).toBeInTheDocument();
  await fireEvent.keyDown(dialog, { key: "Enter" });
  expect(await answer).toBe(true);
  expect(dialog.open).toBe(false);
});

it("Enter cancels a dangerous action and focus starts on Cancel", async () => {
  const { answer, dialog } = open(DANGER);
  expect(screen.getByText("Steve 将无法再进入服务器，直到被解封。")).toBeInTheDocument();
  await settle();
  expect(document.activeElement).toHaveTextContent("取消");
  await fireEvent.keyDown(screen.getByRole("button", { name: "封禁" }), { key: "Enter" });
  expect(await answer).toBe(false);
  expect(dialog.open).toBe(false);
});

it("ignores keyboard-triggered clicks on the dangerous confirm button", async () => {
  const { answer } = open(DANGER);
  let settled = false;
  answer.then(() => (settled = true));
  await fireEvent.click(screen.getByRole("button", { name: "封禁" }), { detail: 0 });
  await Promise.resolve();
  expect(settled).toBe(false);
  await fireEvent.click(screen.getByRole("button", { name: "封禁" }), { detail: 1 });
  expect(await answer).toBe(true);
});

it("Escape and the Cancel button both cancel", async () => {
  const first = open(NORMAL);
  await fireEvent(first.dialog, new Event("cancel", { cancelable: true }));
  expect(await first.answer).toBe(false);

  const answer = first.confirmer.ask(NORMAL);
  flushSync();
  await fireEvent.click(screen.getByRole("button", { name: "取消" }), { detail: 1 });
  expect(await answer).toBe(false);
});

it("a new request cancels the previous one", async () => {
  const confirmer = createConfirmer();
  const first = confirmer.ask(NORMAL);
  confirmer.ask(DANGER);
  expect(await first).toBe(false);
  expect(confirmer.request.title).toBe("确认封禁");
});
