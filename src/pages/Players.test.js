import { fireEvent, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import Players from "./Players.svelte";
import { connectedApp, renderInApp, settle } from "../test-utils.js";

async function setup() {
  const app = await connectedApp();
  renderInApp(Players, {}, app);
  return app;
}

describe("player grid", () => {
  it("shows online players with the server's max", async () => {
    await setup();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("2 / 20");
    expect(screen.getByRole("button", { name: /Steve/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Alex/ })).toBeInTheDocument();
  });

  it("opens the drawer for a clicked player", async () => {
    const app = await setup();
    await fireEvent.click(screen.getByRole("button", { name: /Steve/ }));
    expect(app.ui.drawerPlayer).toBe("Steve");
  });

  it("records a manual refresh", async () => {
    const app = await setup();
    await fireEvent.click(screen.getByRole("button", { name: "刷新在线玩家" }));
    await settle();
    expect(app.history.entries.at(-1).action).toBe("刷新在线玩家");
  });
});

describe("manual player name", () => {
  it("rejects selectors and opens the drawer for a valid name", async () => {
    const app = await setup();
    await fireEvent.click(screen.getByRole("button", { name: "对不在线的玩家操作" }));
    const input = screen.getByLabelText("玩家名");
    await fireEvent.input(input, { target: { value: "@a" } });
    await fireEvent.click(screen.getByRole("button", { name: "打开" }));
    expect(screen.getByText(/玩家名只能包含/)).toBeInTheDocument();
    expect(app.ui.drawerPlayer).toBeNull();

    await fireEvent.input(input, { target: { value: "  Notch_01 " } });
    await fireEvent.click(screen.getByRole("button", { name: "打开" }));
    expect(app.ui.drawerPlayer).toBe("Notch_01");
  });
});

describe("broadcast composer", () => {
  it("counts code points", async () => {
    await setup();
    await fireEvent.input(screen.getByLabelText("广播内容"), { target: { value: "😀😀" } });
    expect(screen.getByText("2 / 256")).toBeInTheDocument();
  });

  it("sends the trimmed message without a confirmation and clears the field", async () => {
    const app = await setup();
    const field = screen.getByLabelText("广播内容");
    await fireEvent.input(field, { target: { value: "  今晚 8 点开活动  " } });
    await fireEvent.click(screen.getByRole("button", { name: "发送" }));
    await settle();
    expect(app.api.perform).toHaveBeenCalledWith({ type: "broadcast", message: "今晚 8 点开活动" });
    expect(app.confirmer.request).toBeNull();
    expect(field).toHaveValue("");
  });

  it("blocks multi-line or empty messages before calling the backend", async () => {
    const app = await setup();
    await fireEvent.click(screen.getByRole("button", { name: "发送" }));
    expect(screen.getByText("广播内容必须是 1–256 个字符的单行文字")).toBeInTheDocument();
    expect(app.api.perform).not.toHaveBeenCalled();
  });

  it("is disabled while reconnecting", async () => {
    const app = await setup();
    app.api.server.online = false;
    await app.session.refreshPlayers();
    await settle();
    expect(screen.getByRole("button", { name: "发送" })).toBeDisabled();
  });
});

describe("recent activity", () => {
  it("shows the three newest entries and links to the full log", async () => {
    const app = await setup();
    for (const action of ["a", "b", "c", "d"]) app.history.record(action, "returned", "");
    await settle();
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((row) => row.querySelector(".what").textContent)).toEqual(["d", "c", "b"]);
    await fireEvent.click(screen.getByRole("button", { name: "查看全部 →" }));
    expect(app.ui.page).toBe("history");
  });
});
