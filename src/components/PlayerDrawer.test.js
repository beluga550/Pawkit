import { fireEvent, screen, within } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import PlayerDrawer from "./PlayerDrawer.svelte";
import { connectedApp, renderInApp, settle } from "../test-utils.js";

async function open(name) {
  const app = await connectedApp();
  app.ui.openPlayer(name);
  renderInApp(PlayerDrawer, {}, app);
  return app;
}

const button = (name) => screen.getByRole("button", { name });

describe("online player", () => {
  it("shows the player as online", async () => {
    await open("Steve");
    const header = screen.getByRole("group", { name: "玩家信息" });
    expect(within(header).getByText("Steve")).toBeInTheDocument();
    expect(within(header).getByText("在线")).toBeInTheDocument();
  });

  it("teleports to nether coordinates only after confirmation", async () => {
    const app = await open("Steve");
    await fireEvent.click(screen.getByRole("radio", { name: "下界" }));
    await fireEvent.input(screen.getByLabelText("X"), { target: { value: "120" } });
    await fireEvent.input(screen.getByLabelText("Y"), { target: { value: "64" } });
    await fireEvent.input(screen.getByLabelText("Z"), { target: { value: "-30" } });
    await fireEvent.click(button(/传送到下界/));
    expect(app.confirmer.request.summary).toBe("将 Steve 传送到下界 (120, 64, -30)。");
    expect(app.api.perform).not.toHaveBeenCalled();
    app.confirmer.answer(true);
    await settle();
    expect(app.api.perform).toHaveBeenCalledWith({
      type: "teleportToCoords",
      player: "Steve",
      dimension: "nether",
      x: 120,
      y: 64,
      z: -30,
    });
  });

  it("rejects missing coordinates before asking", async () => {
    const app = await open("Steve");
    await fireEvent.click(button(/传送到主世界/));
    expect(screen.getByText(/世界边界内的坐标/)).toBeInTheDocument();
    expect(app.confirmer.request).toBeNull();
  });

  it("teleports to another online player but never to itself", async () => {
    const app = await open("Steve");
    await fireEvent.click(screen.getByRole("tab", { name: "到玩家" }));
    const select = screen.getByLabelText("目标玩家");
    const options = within(select).getAllByRole("option").map((option) => option.value).filter(Boolean);
    expect(options).toEqual(["Alex"]);
    await fireEvent.change(select, { target: { value: "Alex" } });
    await fireEvent.click(button("传送到 Alex"));
    app.confirmer.answer(true);
    await settle();
    expect(app.api.perform).toHaveBeenCalledWith({ type: "teleportToPlayer", player: "Steve", target: "Alex" });
  });

  it("changes game mode after confirmation", async () => {
    const app = await open("Alex");
    await fireEvent.click(button("创造"));
    app.confirmer.answer(true);
    await settle();
    expect(app.api.perform).toHaveBeenCalledWith({ type: "setGameMode", player: "Alex", mode: "creative" });
  });

  it("never calls the backend when a ban is cancelled", async () => {
    const app = await open("Steve");
    await fireEvent.input(screen.getByLabelText("原因"), { target: { value: "恶意破坏" } });
    await fireEvent.click(button("封禁"));
    expect(app.confirmer.request.level).toBe("danger");
    app.confirmer.answer(false);
    await settle();
    expect(app.api.perform).not.toHaveBeenCalled();
  });

  it("sends the shared reason with kick", async () => {
    const app = await open("Steve");
    await fireEvent.input(screen.getByLabelText("原因"), { target: { value: "  挂机太久 " } });
    await fireEvent.click(button("踢出"));
    app.confirmer.answer(true);
    await settle();
    expect(app.api.perform).toHaveBeenCalledWith({ type: "kick", player: "Steve", reason: "挂机太久" });
  });

  it("uses the player name as the ban-ip target", async () => {
    const app = await open("Steve");
    await fireEvent.click(button("封 IP"));
    app.confirmer.answer(true);
    await settle();
    expect(app.api.perform).toHaveBeenCalledWith({ type: "banIp", target: "Steve", reason: null });
  });

  it("rejects an over-long reason before asking", async () => {
    const app = await open("Steve");
    await fireEvent.input(screen.getByLabelText("原因"), { target: { value: "x".repeat(101) } });
    await fireEvent.click(button("踢出"));
    expect(screen.getByText("原因最多 100 个字符，且只能是一行文字")).toBeInTheDocument();
    expect(app.confirmer.request).toBeNull();
  });
});

describe("offline player", () => {
  it("disables online-only actions but keeps ban and whitelist", async () => {
    await open("Notch_01");
    expect(within(screen.getByRole("group", { name: "玩家信息" })).getByText("离线")).toBeInTheDocument();
    expect(button(/传送到主世界/)).toBeDisabled();
    expect(button("创造")).toBeDisabled();
    expect(button("踢出")).toBeDisabled();
    expect(button("封 IP")).toBeDisabled();
    expect(button("封禁")).toBeEnabled();
    expect(button("加入白名单")).toBeEnabled();
    expect(button("移出白名单")).toBeEnabled();
    expect(screen.getAllByText("玩家不在线").length).toBeGreaterThan(0);
  });

  it("treats a differently-cased name as online", async () => {
    await open("steve");
    expect(button("踢出")).toBeEnabled();
  });

  it("keeps the drawer open and disables online-only actions when the player leaves", async () => {
    const app = await open("Alex");
    expect(button("踢出")).toBeEnabled();
    app.api.server.players = ["Steve"];
    await app.session.refreshPlayers();
    await settle();
    expect(app.ui.drawerPlayer).toBe("Alex");
    expect(within(screen.getByRole("group", { name: "玩家信息" })).getByText("离线")).toBeInTheDocument();
    expect(button("踢出")).toBeDisabled();
  });
});

describe("closing", () => {
  it("closes with the close button and with Escape", async () => {
    const app = await open("Steve");
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(app.ui.drawerPlayer).toBeNull();
    app.ui.openPlayer("Steve");
    await settle();
    await fireEvent.click(button("关闭"));
    expect(app.ui.drawerPlayer).toBeNull();
  });

  it("disables everything while reconnecting", async () => {
    const app = await open("Steve");
    app.api.server.online = false;
    await app.session.refreshPlayers();
    await settle();
    expect(button("封禁")).toBeDisabled();
    expect(button("加入白名单")).toBeDisabled();
  });
});
