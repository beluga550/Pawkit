import { describe, expect, it } from "vitest";
import fixture from "../../tests/fixtures/validation.json";
import {
  charCount,
  checkBanIpTarget,
  checkCoordinate,
  checkIp,
  checkMessage,
  checkPlayer,
  checkReason,
  checkServerName,
  isPlayerName,
} from "./validate.js";

const expand = (value) => (typeof value === "string" ? value : value.repeat.repeat(value.times));
const cases = (group, kind) => fixture[group][kind].map(expand);

describe("shared fixture (must agree with Rust)", () => {
  const groups = {
    player: checkPlayer,
    message: checkMessage,
    reason: checkReason,
    ip: checkIp,
    serverName: checkServerName,
  };
  for (const [group, check] of Object.entries(groups)) {
    it.each(cases(group, "valid"))(`${group} accepts %j`, (value) => {
      expect(check(value).ok).toBe(true);
    });
    it.each(cases(group, "invalid"))(`${group} rejects %j`, (value) => {
      expect(check(value).ok).toBe(false);
    });
  }
  it.each(fixture.coordinate.valid)("coordinate accepts %j", (value) => {
    expect(checkCoordinate(value).ok).toBe(true);
  });
  it.each(fixture.coordinate.invalid)("coordinate rejects %j", (value) => {
    expect(checkCoordinate(value).ok).toBe(false);
  });
});

describe("normalised values", () => {
  it("trims messages, reasons and server names", () => {
    expect(checkMessage("  hi  ").value).toBe("hi");
    expect(checkReason("  恶意破坏 ").value).toBe("恶意破坏");
    expect(checkServerName(" 生存一服 ").value).toBe("生存一服");
  });

  it("treats a blank reason as no reason", () => {
    expect(checkReason("   ")).toEqual({ ok: true, value: null });
    expect(checkReason(undefined)).toEqual({ ok: true, value: null });
  });

  it("rejects non-numbers as coordinates", () => {
    expect(checkCoordinate(null).ok).toBe(false);
    expect(checkCoordinate("12").ok).toBe(false);
    expect(checkCoordinate(Number.NaN).ok).toBe(false);
  });

  it("accepts an IP or a player name as a ban-ip target", () => {
    expect(checkBanIpTarget("203.0.113.7").ok).toBe(true);
    expect(checkBanIpTarget("Griefer99").ok).toBe(true);
    expect(checkBanIpTarget("1.2.3").ok).toBe(false);
  });

  it("counts code points, not UTF-16 units", () => {
    expect(charCount("😀😀")).toBe(2);
    expect(isPlayerName("Steve")).toBe(true);
  });

  it("gives a Chinese error message on failure", () => {
    expect(checkPlayer("@a").error).toMatch(/玩家名/);
  });
});
