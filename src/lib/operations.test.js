import { describe as group, expect, it, vi } from "vitest";
import { describe, executeOperation } from "./operations.js";

const level = (action) => describe(action).confirm?.level ?? "none";

group("describe", () => {
  it("assigns the confirmation level from the spec", () => {
    expect(level({ type: "broadcast", message: "hi" })).toBe("none");
    for (const action of [
      { type: "teleportToPlayer", player: "Steve", target: "Alex" },
      { type: "teleportToCoords", player: "Steve", dimension: "nether", x: 1, y: 2, z: 3 },
      { type: "setGameMode", player: "Steve", mode: "creative" },
      { type: "kick", player: "Steve", reason: null },
      { type: "whitelistAdd", player: "Steve" },
      { type: "whitelistRemove", player: "Steve" },
      { type: "pardon", player: "Steve" },
      { type: "pardonIp", ip: "203.0.113.7" },
    ]) {
      expect(level(action)).toBe("normal");
    }
    for (const action of [
      { type: "ban", player: "Steve", reason: null },
      { type: "banIp", target: "203.0.113.7", reason: null },
      { type: "whitelistSetEnabled", enabled: true },
      { type: "whitelistSetEnabled", enabled: false },
    ]) {
      expect(level(action)).toBe("danger");
    }
  });

  it("writes readable history labels", () => {
    expect(describe({ type: "broadcast", message: "今晚 8 点" }).label).toBe("广播：今晚 8 点");
    expect(describe({ type: "teleportToCoords", player: "Steve", dimension: "nether", x: 120, y: 64, z: -30 }).label).toBe(
      "传送：Steve → 下界 (120, 64, -30)",
    );
    expect(describe({ type: "kick", player: "Griefer99", reason: "恶意破坏" }).label).toBe("踢出 Griefer99 · 原因：恶意破坏");
    expect(describe({ type: "setGameMode", player: "Alex", mode: "spectator" }).label).toBe("游戏模式：Alex → 旁观");
  });

  it("spells out the consequences of dangerous actions", () => {
    expect(describe({ type: "ban", player: "Steve", reason: null }).confirm.consequence).toBe("Steve 将无法再进入服务器，直到被解封。");
    expect(describe({ type: "banIp", target: "1.2.3.4", reason: null }).confirm.consequence).toBe("同一网络（IP）下的所有人都将无法进入服务器。");
    expect(describe({ type: "whitelistSetEnabled", enabled: true }).confirm.consequence).toBe("不在白名单上的玩家将无法进入服务器。");
    expect(describe({ type: "whitelistSetEnabled", enabled: false }).confirm.consequence).toBe("任何知道服务器地址的人都可以进入。");
  });
});

group("executeOperation", () => {
  function setup(answer) {
    const session = { status: "connected", pending: null, run: vi.fn(async () => ({ ok: true, output: "done" })) };
    const confirmer = { ask: vi.fn(async () => answer) };
    return { session, confirmer };
  }

  it("never calls the backend when the user cancels", async () => {
    const context = setup(false);
    const result = await executeOperation(context, { type: "ban", player: "Steve", reason: null });
    expect(result).toEqual({ ok: false, cancelled: true });
    expect(context.session.run).not.toHaveBeenCalled();
  });

  it("runs once after confirmation with the history label", async () => {
    const context = setup(true);
    await executeOperation(context, { type: "kick", player: "Steve", reason: null });
    expect(context.confirmer.ask).toHaveBeenCalledOnce();
    expect(context.session.run).toHaveBeenCalledWith({ type: "kick", player: "Steve", reason: null }, "踢出 Steve");
  });

  it("does not ask before a broadcast", async () => {
    const context = setup(true);
    await executeOperation(context, { type: "broadcast", message: "hi" });
    expect(context.confirmer.ask).not.toHaveBeenCalled();
    expect(context.session.run).toHaveBeenCalledOnce();
  });

  it("does not open a dialog when nothing can run", async () => {
    const context = setup(true);
    context.session.status = "reconnecting";
    expect((await executeOperation(context, { type: "kick", player: "Steve", reason: null })).skipped).toBe(true);
    context.session.status = "connected";
    context.session.pending = { type: "ban" };
    expect((await executeOperation(context, { type: "kick", player: "Steve", reason: null })).skipped).toBe(true);
    expect(context.confirmer.ask).not.toHaveBeenCalled();
  });
});
