import { fireEvent, screen, within } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import Whitelist from "./Whitelist.svelte";
import { connectedApp, fakeApi, renderInApp, settle } from "../test-utils.js";

async function setup() {
  const api = fakeApi();
  api.server.whitelist = { output: "There are 2 whitelisted player(s): Steve, Kai_Builds", players: ["Steve", "Kai_Builds"] };
  const app = await connectedApp(api);
  renderInApp(Whitelist, {}, app);
  await settle();
  return app;
}

const whitelistQueries = (app) => app.api.query.mock.calls.filter(([query]) => query.type === "whitelist").length;

it("lists whitelisted players with the raw output", async () => {
  await setup();
  expect(screen.getByText("Kai_Builds")).toBeInTheDocument();
  expect(screen.getByText("There are 2 whitelisted player(s): Steve, Kai_Builds")).toBeInTheDocument();
});

it("removes a player after confirmation and reloads", async () => {
  const app = await setup();
  await fireEvent.click(within(screen.getByText("Kai_Builds").closest("li")).getByRole("button", { name: "移除" }));
  expect(app.confirmer.request.level).toBe("normal");
  app.confirmer.answer(true);
  await settle();
  expect(app.api.perform).toHaveBeenCalledWith({ type: "whitelistRemove", player: "Kai_Builds" });
  expect(whitelistQueries(app)).toBe(2);
});

it("validates the name before adding", async () => {
  const app = await setup();
  const field = screen.getByLabelText("要加入白名单的玩家名");
  await fireEvent.input(field, { target: { value: "bad name" } });
  await fireEvent.click(screen.getByRole("button", { name: "添加" }));
  expect(screen.getByText(/玩家名只能包含/)).toBeInTheDocument();
  expect(app.confirmer.request).toBeNull();

  await fireEvent.input(field, { target: { value: "Alex" } });
  await fireEvent.click(screen.getByRole("button", { name: "添加" }));
  app.confirmer.answer(true);
  await settle();
  expect(app.api.perform).toHaveBeenCalledWith({ type: "whitelistAdd", player: "Alex" });
});

it("turning the whitelist on or off is a dangerous action", async () => {
  const app = await setup();
  await fireEvent.click(screen.getByRole("button", { name: "开启白名单" }));
  expect(app.confirmer.request).toMatchObject({ level: "danger", consequence: "不在白名单上的玩家将无法进入服务器。" });
  app.confirmer.answer(false);
  await fireEvent.click(screen.getByRole("button", { name: "关闭白名单" }));
  expect(app.confirmer.request).toMatchObject({ level: "danger", consequence: "任何知道服务器地址的人都可以进入。" });
  app.confirmer.answer(true);
  await settle();
  expect(app.api.perform).toHaveBeenCalledWith({ type: "whitelistSetEnabled", enabled: false });
});

it("records a manual refresh", async () => {
  const app = await setup();
  await fireEvent.click(screen.getByRole("button", { name: "刷新白名单" }));
  await settle();
  expect(app.history.entries.at(-1).action).toBe("刷新白名单");
});

describe("load failures", () => {
  it("shows a failure instead of loading forever and reloads after recovery", async () => {
    const api = fakeApi();
    api.server.whitelist = { output: "There are 1 whitelisted player(s): Kai_Builds", players: ["Kai_Builds"] };
    const app = await connectedApp(api);
    api.server.online = false;
    renderInApp(Whitelist, {}, app);
    await settle();
    expect(screen.queryByText(/正在读取/)).toBeNull();
    expect(screen.getByText(/读取失败/)).toBeInTheDocument();
    api.server.online = true;
    await app.session.refreshPlayers();
    await settle();
    expect(screen.getByText("Kai_Builds")).toBeInTheDocument();
  });
});
