import { expect, it } from "vitest";
import { errorInfo } from "./api.js";

it("passes backend errors through", () => {
  expect(errorInfo({ kind: "unknown", message: "可能已送达" })).toEqual({ kind: "unknown", message: "可能已送达" });
});

it("treats anything else as an internal error", () => {
  expect(errorInfo("invalid args `action` for command `perform`")).toEqual({
    kind: "internal",
    message: "invalid args `action` for command `perform`",
  });
  expect(errorInfo(new Error("boom"))).toEqual({ kind: "internal", message: "boom" });
  expect(errorInfo(undefined).kind).toBe("internal");
});
