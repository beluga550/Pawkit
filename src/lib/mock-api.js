// Browser-preview backend (npm run dev:mock). Never part of the packaged app.
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MODE_NAMES = { survival: "Survival", creative: "Creative", adventure: "Adventure", spectator: "Spectator" };

function banlist(map) {
  if (map.size === 0) return "There are no bans";
  const lines = [...map].map(([subject, reason]) => `${subject} was banned by Rcon: ${reason}`);
  return `There are ${map.size} ban(s):\n${lines.join("\n")}`;
}

export function createMockApi() {
  const server = {
    players: ["Steve", "Alex", "Notch_01", "Kai_Builds"],
    max: 20,
    bans: new Map([["Griefer99", "恶意破坏"]]),
    ipBans: new Map([["203.0.113.7", "小号刷屏"]]),
    whitelist: new Set(["Steve", "Alex"]),
  };
  const drop = (name) => {
    server.players = server.players.filter((player) => player.toLowerCase() !== name.toLowerCase());
  };

  return {
    server,
    async connect(_profile, password) {
      await wait(400);
      if (password === "wrong") throw { kind: "disconnected", message: "无法连接或验证 RCON，请检查网络、端口和密码" };
    },
    async reconnect() {
      await wait(300);
    },
    async disconnect() {},
    async query({ type }) {
      await wait(200);
      if (type === "onlinePlayers") {
        return {
          output: `There are ${server.players.length} of a max of ${server.max} players online: ${server.players.join(", ")}`,
          players: [...server.players],
          max: server.max,
        };
      }
      if (type === "bans") {
        return {
          playersOutput: banlist(server.bans),
          ipsOutput: banlist(server.ipBans),
          players: [...server.bans].map(([name, reason]) => ({ name, reason })),
          ips: [...server.ipBans].map(([ip, reason]) => ({ ip, reason })),
        };
      }
      const names = [...server.whitelist];
      return {
        output: names.length ? `There are ${names.length} whitelisted player(s): ${names.join(", ")}` : "There are no whitelisted players",
        players: names,
      };
    },
    async perform(action) {
      await wait(300);
      const { type } = action;
      if (type === "broadcast") {
        if (action.message === "unknown") throw { kind: "unknown", message: "命令可能已经送达，但没有收到完整回复" };
        return "";
      }
      if (type === "teleportToPlayer") return `Teleported ${action.player} to ${action.target}`;
      if (type === "teleportToCoords") return `Teleported ${action.player} to ${action.x}, ${action.y}, ${action.z}`;
      if (type === "setGameMode") return `Set ${action.player}'s game mode to ${MODE_NAMES[action.mode]} Mode`;
      if (type === "kick") {
        drop(action.player);
        return `Kicked ${action.player}: ${action.reason ?? "Kicked by an operator"}`;
      }
      if (type === "ban") {
        server.bans.set(action.player, action.reason ?? "Banned by an operator.");
        drop(action.player);
        return `Banned ${action.player}: ${action.reason ?? "Banned by an operator."}`;
      }
      if (type === "banIp") {
        server.ipBans.set(action.target, action.reason ?? "Banned by an operator.");
        return `Banned IP ${action.target}: ${action.reason ?? "Banned by an operator."}`;
      }
      if (type === "pardon") {
        server.bans.delete(action.player);
        return `Unbanned ${action.player}`;
      }
      if (type === "pardonIp") {
        server.ipBans.delete(action.ip);
        return `Unbanned IP ${action.ip}`;
      }
      if (type === "whitelistAdd") {
        server.whitelist.add(action.player);
        return `Added ${action.player} to the whitelist`;
      }
      if (type === "whitelistRemove") {
        server.whitelist.delete(action.player);
        return `Removed ${action.player} from the whitelist`;
      }
      if (type === "whitelistSetEnabled") return `Whitelist is now turned ${action.enabled ? "on" : "off"}`;
      throw { kind: "invalid_input", message: `未知操作 ${type}` };
    },
  };
}
