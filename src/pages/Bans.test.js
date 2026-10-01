import { fireEvent, screen, within } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import Bans from "./Bans.svelte";
import { connectedApp, fakeApi, renderInApp, settle } from "../test-utils.js";

const PARSED = {
  playersOutput: "There are 1 ban(s):\nGriefer99 was banned by Rcon: 恶意破坏",
  ipsOutput: "There are 1 ban(s):\n203.0.113.7 was banned by Rcon: 小号刷屏",
  players: [{ name: "Griefer99", reason: "恶意破坏" }],
  ips: [{ ip: "203.0.113.7", reason: "小号刷屏" }],
};

async function setup(bans = PARSED) {
  const api = fakeApi();
  api.server.bans = bans;
  const app = await connectedApp(api);
  renderInApp(Bans, {}, app);
  await settle();
  return app;
}

const bansQueries = (app) => app.api.query.mock.calls.filter(([query]) => query.type === "bans").length;

describe("player bans", () => {
  it("loads the list when opened without writing history", async () => {
    const app = await setup();
    expect(bansQueries(app)).toBe(1);
    const row = screen.getByText("Griefer99").closest("li");
    expect(within(row).getByText("恶意破坏")).toBeInTheDocument();
    expect(app.history.entries.map((entry) => entry.action)).toEqual(["连接服务器"]);
  });

  it("pardons after confirmation and reloads the list", async () => {
    const app = await setup();
    await fireEvent.click(within(screen.getByText("Griefer99").closest("li")).getByRole("button", { name: "解封" }));
    expect(app.confirmer.request.summary).toBe("解除对 Griefer99 的封禁。");
    app.confirmer.answer(true);
    await settle();
    expect(app.api.perform).toHaveBeenCalledWith({ type: "pardon", player: "Griefer99" });
    expect(bansQueries(app)).toBe(2);
  });

  it("falls back to raw output and a manual pardon field when the list cannot be parsed", async () => {
    const app = await setup({ ...PARSED, players: null, playersOutput: "There are 2 ban(s):Ab was banned by Rcon: xCd was banned by Rcon: y" });
    expect(screen.getByText(/无法可靠解析/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "解封" })).toBeNull();
    expect(screen.getByText(/There are 2 ban\(s\):Ab was banned/)).toBeInTheDocument();

    const field = screen.getByLabelText("要解封的玩家名");
    await fireEvent.input(field, { target: { value: "@a" } });
    await fireEvent.click(screen.getByRole("button", { name: "手动解封" }));
    expect(screen.getByText(/玩家名只能包含/)).toBeInTheDocument();
    expect(app.confirmer.request).toBeNull();

    await fireEvent.input(field, { target: { value: " Griefer99 " } });
    await fireEvent.click(screen.getByRole("button", { name: "手动解封" }));
    expect(screen.queryByText(/玩家名只能包含/)).toBeNull();
    expect(app.confirmer.request.summary).toBe("解除对 Griefer99 的封禁。");
  });

  it("records a manual refresh", async () => {
    const app = await setup();
    await fireEvent.click(screen.getByRole("button", { name: "刷新封禁名单" }));
    await settle();
    expect(app.history.entries.at(-1).action).toBe("刷新封禁名单");
  });
});

describe("ip bans", () => {
  it("pardons an IP from the list", async () => {
    const app = await setup();
    await fireEvent.click(screen.getByRole("tab", { name: /IP/ }));
    await fireEvent.click(within(screen.getByText("203.0.113.7").closest("li")).getByRole("button", { name: "解封" }));
    app.confirmer.answer(true);
    await settle();
    expect(app.api.perform).toHaveBeenCalledWith({ type: "pardonIp", ip: "203.0.113.7" });
  });

  it("bans an IP with a reason after a dangerous confirmation", async () => {
    const app = await setup();
    await fireEvent.click(screen.getByRole("tab", { name: /IP/ }));
    const target = screen.getByLabelText("IP 地址或玩家名");
    await fireEvent.input(target, { target: { value: "1.2.3" } });
    await fireEvent.click(screen.getByRole("button", { name: "封禁 IP 地址" }));
    expect(screen.getByText("请输入有效的 IP 地址或玩家名")).toBeInTheDocument();

    await fireEvent.input(target, { target: { value: "198.51.100.4" } });
    await fireEvent.input(screen.getByLabelText("封禁原因"), { target: { value: "刷屏" } });
    await fireEvent.click(screen.getByRole("button", { name: "封禁 IP 地址" }));
    expect(app.confirmer.request.level).toBe("danger");
    app.confirmer.answer(true);
    await settle();
    expect(app.api.perform).toHaveBeenCalledWith({ type: "banIp", target: "198.51.100.4", reason: "刷屏" });
  });
});
