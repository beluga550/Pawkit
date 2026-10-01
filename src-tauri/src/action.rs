use std::net::IpAddr;

use serde::Deserialize;

use crate::error::AppError;

pub const MAX_COORDINATE: f64 = 29_999_984.0;
const MAX_MESSAGE_CHARS: usize = 256;
const MAX_REASON_CHARS: usize = 100;

#[derive(Debug, Clone, Copy, PartialEq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Dimension {
    Overworld,
    Nether,
    End,
}

impl Dimension {
    fn id(self) -> &'static str {
        match self {
            Self::Overworld => "minecraft:overworld",
            Self::Nether => "minecraft:the_nether",
            Self::End => "minecraft:the_end",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GameMode {
    Survival,
    Creative,
    Adventure,
    Spectator,
}

impl GameMode {
    fn id(self) -> &'static str {
        match self {
            Self::Survival => "survival",
            Self::Creative => "creative",
            Self::Adventure => "adventure",
            Self::Spectator => "spectator",
        }
    }
}

/// Everything that changes server state. Each variant maps to one fixed command.
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Action {
    Broadcast {
        message: String,
    },
    TeleportToPlayer {
        player: String,
        target: String,
    },
    TeleportToCoords {
        player: String,
        dimension: Dimension,
        x: f64,
        y: f64,
        z: f64,
    },
    SetGameMode {
        player: String,
        mode: GameMode,
    },
    Kick {
        player: String,
        #[serde(default)]
        reason: Option<String>,
    },
    Ban {
        player: String,
        #[serde(default)]
        reason: Option<String>,
    },
    BanIp {
        target: String,
        #[serde(default)]
        reason: Option<String>,
    },
    Pardon {
        player: String,
    },
    PardonIp {
        ip: String,
    },
    WhitelistAdd {
        player: String,
    },
    WhitelistRemove {
        player: String,
    },
    WhitelistSetEnabled {
        enabled: bool,
    },
}

/// Read-only lookups. Safe to refresh and retry.
#[derive(Debug, Clone, Copy, PartialEq, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Query {
    OnlinePlayers,
    Bans,
    Whitelist,
}

impl Query {
    pub fn commands(self) -> &'static [&'static str] {
        match self {
            Self::OnlinePlayers => &["list"],
            Self::Bans => &["banlist players", "banlist ips"],
            Self::Whitelist => &["whitelist list"],
        }
    }
}

pub fn validate_player(player: &str) -> Result<&str, AppError> {
    if (3..=16).contains(&player.len())
        && player
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
    {
        Ok(player)
    } else {
        Err(AppError::invalid(
            "玩家名只能包含 3–16 位英文字母、数字或下划线；不支持 @a 等选择器",
        ))
    }
}

fn single_line(text: &str) -> bool {
    !text.chars().any(char::is_control)
}

pub fn validate_message(message: &str) -> Result<&str, AppError> {
    let message = message.trim();
    if message.is_empty() || message.chars().count() > MAX_MESSAGE_CHARS || !single_line(message) {
        return Err(AppError::invalid("广播内容必须是 1–256 个字符的单行文字"));
    }
    Ok(message)
}

/// Blank reasons count as "no reason".
pub fn validate_reason(reason: Option<&str>) -> Result<Option<&str>, AppError> {
    let Some(reason) = reason.map(str::trim).filter(|reason| !reason.is_empty()) else {
        return Ok(None);
    };
    if reason.chars().count() > MAX_REASON_CHARS || !single_line(reason) {
        return Err(AppError::invalid("原因最多 100 个字符，且只能是一行文字"));
    }
    Ok(Some(reason))
}

pub fn validate_ip(ip: &str) -> Result<IpAddr, AppError> {
    ip.parse::<IpAddr>()
        .map_err(|_| AppError::invalid("请输入有效的 IP 地址，例如 203.0.113.7"))
}

pub fn validate_coordinate(value: f64) -> Result<f64, AppError> {
    if value.is_finite() && value.abs() <= MAX_COORDINATE {
        Ok(value)
    } else {
        Err(AppError::invalid("坐标必须是世界边界内的有限数字"))
    }
}

/// An IP address or a player name. The two never overlap: names have no `.` or `:`.
fn validate_ban_ip_target(target: &str) -> Result<String, AppError> {
    if let Ok(ip) = target.parse::<IpAddr>() {
        return Ok(ip.to_string());
    }
    validate_player(target)
        .map(str::to_owned)
        .map_err(|_| AppError::invalid("请输入有效的 IP 地址或玩家名"))
}

fn with_reason(command: String, reason: Option<&String>) -> Result<String, AppError> {
    Ok(match validate_reason(reason.map(String::as_str))? {
        Some(reason) => format!("{command} {reason}"),
        None => command,
    })
}

impl Action {
    pub fn command(&self) -> Result<String, AppError> {
        match self {
            Self::Broadcast { message } => Ok(format!("say {}", validate_message(message)?)),
            Self::TeleportToPlayer { player, target } => {
                let player = validate_player(player)?;
                let target = validate_player(target)?;
                if player.eq_ignore_ascii_case(target) {
                    return Err(AppError::invalid("要传送的玩家和目标不能是同一人"));
                }
                Ok(format!("tp {player} {target}"))
            }
            Self::TeleportToCoords {
                player,
                dimension,
                x,
                y,
                z,
            } => {
                let player = validate_player(player)?;
                let (x, y, z) = (
                    validate_coordinate(*x)?,
                    validate_coordinate(*y)?,
                    validate_coordinate(*z)?,
                );
                Ok(format!(
                    "execute in {} run tp {player} {x} {y} {z}",
                    dimension.id()
                ))
            }
            Self::SetGameMode { player, mode } => {
                Ok(format!("gamemode {} {}", mode.id(), validate_player(player)?))
            }
            Self::Kick { player, reason } => {
                with_reason(format!("kick {}", validate_player(player)?), reason.as_ref())
            }
            Self::Ban { player, reason } => {
                with_reason(format!("ban {}", validate_player(player)?), reason.as_ref())
            }
            Self::BanIp { target, reason } => with_reason(
                format!("ban-ip {}", validate_ban_ip_target(target)?),
                reason.as_ref(),
            ),
            Self::Pardon { player } => Ok(format!("pardon {}", validate_player(player)?)),
            Self::PardonIp { ip } => Ok(format!("pardon-ip {}", validate_ip(ip)?)),
            Self::WhitelistAdd { player } => {
                Ok(format!("whitelist add {}", validate_player(player)?))
            }
            Self::WhitelistRemove { player } => {
                Ok(format!("whitelist remove {}", validate_player(player)?))
            }
            Self::WhitelistSetEnabled { enabled } => Ok(format!(
                "whitelist {}",
                if *enabled { "on" } else { "off" }
            )),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    const FIXTURE: &str = include_str!("../../tests/fixtures/validation.json");

    fn expand(value: &Value) -> String {
        match value {
            Value::String(text) => text.clone(),
            Value::Object(spec) => spec["repeat"]
                .as_str()
                .unwrap()
                .repeat(spec["times"].as_u64().unwrap() as usize),
            other => panic!("unexpected fixture value {other}"),
        }
    }

    fn cases(group: &str, kind: &str) -> Vec<String> {
        let fixture: Value = serde_json::from_str(FIXTURE).unwrap();
        fixture[group][kind]
            .as_array()
            .unwrap()
            .iter()
            .map(expand)
            .collect()
    }

    fn action(json: &str) -> Action {
        serde_json::from_str(json).unwrap()
    }

    fn command(json: &str) -> String {
        action(json).command().unwrap()
    }

    fn rejected(json: &str) -> bool {
        action(json).command().is_err()
    }

    #[test]
    fn shared_fixture_player_names() {
        for name in cases("player", "valid") {
            assert!(validate_player(&name).is_ok(), "should accept {name:?}");
        }
        for name in cases("player", "invalid") {
            assert!(validate_player(&name).is_err(), "should reject {name:?}");
        }
    }

    #[test]
    fn shared_fixture_messages() {
        for text in cases("message", "valid") {
            assert!(validate_message(&text).is_ok(), "should accept {text:?}");
        }
        for text in cases("message", "invalid") {
            assert!(validate_message(&text).is_err(), "should reject {text:?}");
        }
    }

    #[test]
    fn shared_fixture_reasons() {
        for text in cases("reason", "valid") {
            assert!(validate_reason(Some(&text)).is_ok(), "should accept {text:?}");
        }
        for text in cases("reason", "invalid") {
            assert!(validate_reason(Some(&text)).is_err(), "should reject {text:?}");
        }
    }

    #[test]
    fn shared_fixture_ips() {
        for ip in cases("ip", "valid") {
            assert!(validate_ip(&ip).is_ok(), "should accept {ip:?}");
        }
        for ip in cases("ip", "invalid") {
            assert!(validate_ip(&ip).is_err(), "should reject {ip:?}");
        }
    }

    #[test]
    fn shared_fixture_coordinates() {
        let fixture: Value = serde_json::from_str(FIXTURE).unwrap();
        for value in fixture["coordinate"]["valid"].as_array().unwrap() {
            assert!(validate_coordinate(value.as_f64().unwrap()).is_ok(), "should accept {value}");
        }
        for value in fixture["coordinate"]["invalid"].as_array().unwrap() {
            assert!(validate_coordinate(value.as_f64().unwrap()).is_err(), "should reject {value}");
        }
        assert!(validate_coordinate(f64::NAN).is_err());
        assert!(validate_coordinate(f64::INFINITY).is_err());
    }

    #[test]
    fn builds_every_action_command() {
        assert_eq!(command(r#"{"type":"broadcast","message":"  今晚 8 点  "}"#), "say 今晚 8 点");
        assert_eq!(command(r#"{"type":"teleportToPlayer","player":"Steve","target":"Alex"}"#), "tp Steve Alex");
        assert_eq!(
            command(r#"{"type":"teleportToCoords","player":"Steve","dimension":"overworld","x":12.5,"y":64,"z":-30}"#),
            "execute in minecraft:overworld run tp Steve 12.5 64 -30"
        );
        assert_eq!(
            command(r#"{"type":"teleportToCoords","player":"Steve","dimension":"nether","x":120,"y":64,"z":-30}"#),
            "execute in minecraft:the_nether run tp Steve 120 64 -30"
        );
        assert_eq!(
            command(r#"{"type":"teleportToCoords","player":"Steve","dimension":"end","x":0,"y":80,"z":0}"#),
            "execute in minecraft:the_end run tp Steve 0 80 0"
        );
        assert_eq!(command(r#"{"type":"setGameMode","player":"Alex","mode":"creative"}"#), "gamemode creative Alex");
        assert_eq!(command(r#"{"type":"setGameMode","player":"Alex","mode":"spectator"}"#), "gamemode spectator Alex");
        assert_eq!(command(r#"{"type":"kick","player":"Griefer99"}"#), "kick Griefer99");
        assert_eq!(command(r#"{"type":"kick","player":"Griefer99","reason":null}"#), "kick Griefer99");
        assert_eq!(command(r#"{"type":"kick","player":"Griefer99","reason":"  恶意破坏 "}"#), "kick Griefer99 恶意破坏");
        assert_eq!(command(r#"{"type":"kick","player":"Griefer99","reason":"   "}"#), "kick Griefer99");
        assert_eq!(command(r#"{"type":"ban","player":"Griefer99","reason":"griefing"}"#), "ban Griefer99 griefing");
        assert_eq!(command(r#"{"type":"ban","player":"Griefer99"}"#), "ban Griefer99");
        assert_eq!(command(r#"{"type":"banIp","target":"203.0.113.7","reason":"spam"}"#), "ban-ip 203.0.113.7 spam");
        assert_eq!(command(r#"{"type":"banIp","target":"Griefer99"}"#), "ban-ip Griefer99");
        assert_eq!(command(r#"{"type":"banIp","target":"2001:DB8::1"}"#), "ban-ip 2001:db8::1");
        assert_eq!(command(r#"{"type":"pardon","player":"Griefer99"}"#), "pardon Griefer99");
        assert_eq!(command(r#"{"type":"pardonIp","ip":"203.0.113.7"}"#), "pardon-ip 203.0.113.7");
        assert_eq!(command(r#"{"type":"whitelistAdd","player":"Kai_Builds"}"#), "whitelist add Kai_Builds");
        assert_eq!(command(r#"{"type":"whitelistRemove","player":"Kai_Builds"}"#), "whitelist remove Kai_Builds");
        assert_eq!(command(r#"{"type":"whitelistSetEnabled","enabled":true}"#), "whitelist on");
        assert_eq!(command(r#"{"type":"whitelistSetEnabled","enabled":false}"#), "whitelist off");
    }

    #[test]
    fn rejects_newline_injection_and_selectors() {
        assert!(rejected(r#"{"type":"broadcast","message":"hi\nstop"}"#));
        assert!(rejected(r#"{"type":"kick","player":"Steve","reason":"bye\nop Griefer99"}"#));
        assert!(rejected(r#"{"type":"ban","player":"@a"}"#));
        assert!(serde_json::from_str::<Action>(r#"{"type":"teleportToPlayer","player":"Steve"}"#).is_err());
        assert!(rejected(r#"{"type":"setGameMode","player":"@p","mode":"creative"}"#));
        assert!(rejected(r#"{"type":"whitelistAdd","player":"Steve stop"}"#));
        assert!(rejected(r#"{"type":"pardon","player":"Steve\nstop"}"#));
    }

    #[test]
    fn rejects_bad_ips_coordinates_and_long_reasons() {
        assert!(rejected(r#"{"type":"pardonIp","ip":"256.1.1.1"}"#));
        assert!(rejected(r#"{"type":"pardonIp","ip":"1.2.3.4 stop"}"#));
        assert!(rejected(r#"{"type":"banIp","target":"1.2.3"}"#));
        assert!(rejected(r#"{"type":"teleportToCoords","player":"Steve","dimension":"overworld","x":30000000,"y":64,"z":0}"#));
        let long_reason = format!(r#"{{"type":"ban","player":"Steve","reason":"{}"}}"#, "x".repeat(101));
        assert!(rejected(&long_reason));
        let nan = Action::TeleportToCoords {
            player: "Steve".into(),
            dimension: Dimension::Overworld,
            x: f64::NAN,
            y: 64.0,
            z: 0.0,
        };
        assert!(nan.command().is_err());
    }

    #[test]
    fn teleport_to_same_player_is_rejected_case_insensitively() {
        assert!(rejected(r#"{"type":"teleportToPlayer","player":"Steve","target":"Steve"}"#));
        assert!(rejected(r#"{"type":"teleportToPlayer","player":"steve","target":"Steve"}"#));
    }

    #[test]
    fn unknown_types_dimensions_and_modes_do_not_deserialize() {
        assert!(serde_json::from_str::<Action>(r#"{"type":"op","player":"Steve"}"#).is_err());
        assert!(serde_json::from_str::<Action>(r#"{"type":"raw","command":"stop"}"#).is_err());
        assert!(serde_json::from_str::<Action>(
            r#"{"type":"teleportToCoords","player":"Steve","dimension":"the_moon","x":0,"y":0,"z":0}"#
        )
        .is_err());
        assert!(serde_json::from_str::<Action>(r#"{"type":"setGameMode","player":"Steve","mode":"hardcore"}"#).is_err());
        assert!(serde_json::from_str::<Query>(r#"{"type":"anything"}"#).is_err());
    }

    #[test]
    fn queries_map_to_fixed_commands() {
        let query = |json: &str| serde_json::from_str::<Query>(json).unwrap();
        assert_eq!(query(r#"{"type":"onlinePlayers"}"#).commands(), ["list"]);
        assert_eq!(query(r#"{"type":"bans"}"#).commands(), ["banlist players", "banlist ips"]);
        assert_eq!(query(r#"{"type":"whitelist"}"#).commands(), ["whitelist list"]);
    }
}
