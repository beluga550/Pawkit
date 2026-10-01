import { fireEvent, render } from "@testing-library/svelte";
import { expect, it } from "vitest";
import Avatar from "./Avatar.svelte";

it("draws the generated head immediately", () => {
  const { container } = render(Avatar, { name: "Steve", real: false });
  expect(container.querySelector("svg rect")).not.toBeNull();
});

it("never requests a remote image when real avatars are off", () => {
  const { container } = render(Avatar, { name: "Steve", real: false });
  expect(container.querySelector("img")).toBeNull();
});

it("never builds a URL from an invalid name", () => {
  const { container } = render(Avatar, { name: "@a", real: true });
  expect(container.querySelector("img")).toBeNull();
});

it("fades the real skin in only after it loads", async () => {
  const { container } = render(Avatar, { name: "Kai_Builds", real: true });
  const img = container.querySelector("img");
  expect(img.getAttribute("src")).toBe("https://mc-heads.net/avatar/Kai_Builds/64");
  expect(img).not.toHaveClass("loaded");
  await fireEvent.load(img);
  expect(img).toHaveClass("loaded");
});

it("keeps the generated head when the image fails", async () => {
  const { container } = render(Avatar, { name: "Steve", real: true });
  const img = container.querySelector("img");
  await fireEvent.error(img);
  expect(img).not.toHaveClass("loaded");
  expect(container.querySelector("svg")).not.toBeNull();
});
