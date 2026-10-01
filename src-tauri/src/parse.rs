use serde::Serialize;

use crate::action::{validate_ip, validate_player, Query};

#[derive(Debug, PartialEq, Serialize)]
pub struct OnlinePlayers {
    pub output: String,
    pub players: Vec<String>,
    pub max: Option<u32>,
}

#[derive(Debug, PartialEq, Serialize)]
pub struct PlayerBan {
    pub name: String,
    pub reason: String,
}

#[derive(Debug, PartialEq, Serialize)]
pub struct IpBan {
    pub ip: String,
    pub reason: String,
}

/// `None` means the output could not be parsed reliably; the UI then shows the
/// raw text and a manual pardon field instead of per-entry buttons.
#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BanLists {
    pub players_output: String,
    pub ips_output: String,
    pub players: Option<Vec<PlayerBan>>,
    pub ips: Option<Vec<IpBan>>,
}

#[derive(Debug, PartialEq, Serialize)]
pub struct WhitelistInfo {
    pub output: String,
    pub players: Vec<String>,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(untagged)]
pub enum QueryResponse {
    OnlinePlayers(OnlinePlayers),
    Bans(BanLists),
    Whitelist(WhitelistInfo),
}

/// `outputs` holds one server reply per command in `query.commands()`.
pub fn response(query: Query, outputs: Vec<String>) -> QueryResponse {
    let mut outputs = outputs.into_iter();
    let mut next = || outputs.next().unwrap_or_default();
    match query {
        Query::OnlinePlayers => {
            let output = next();
            QueryResponse::OnlinePlayers(OnlinePlayers {
                players: names_after_colon(&output),
                max: max_players(&output),
                output,
            })
        }
        Query::Bans => {
            let players_output = next();
            let ips_output = next();
            QueryResponse::Bans(BanLists {
                players: player_bans(&players_output),
                ips: ip_bans(&ips_output),
                players_output,
                ips_output,
            })
        }
        Query::Whitelist => {
            let output = next();
            QueryResponse::Whitelist(WhitelistInfo {
                players: names_after_colon(&output),
                output,
            })
        }
    }
}

/// `list` and `whitelist list` put the names after the last `:`.
fn names_after_colon(output: &str) -> Vec<String> {
    let Some((_, names)) = output.rsplit_once(':') else {
        return Vec::new();
    };
    names
        .split(',')
        .map(str::trim)
        .filter(|name| validate_player(name).is_ok())
        .map(str::to_owned)
        .collect()
}

/// Reads N from "... of a max of N players online ...".
fn max_players(output: &str) -> Option<u32> {
    let (_, rest) = output.split_once("of a max of ")?;
    let digits: String = rest.chars().take_while(char::is_ascii_digit).collect();
    digits.parse().ok()
}

/// Splits `banlist` output into `(name or ip, reason)` pairs, or `None` when the
/// entry count does not match the "There are N ban(s)" header.
fn ban_entries(output: &str) -> Option<Vec<(String, String)>> {
    let text = output.trim();
    if text.starts_with("There are no bans") {
        return Some(Vec::new());
    }
    let rest = text.strip_prefix("There are ")?;
    let (count, rest) = rest.split_once(' ')?;
    let count: usize = count.parse().ok()?;
    let (_, entries) = rest.split_once(':')?;
    let mut parsed = Vec::new();
    for line in entries.lines().map(str::trim).filter(|line| !line.is_empty()) {
        let (subject, rest) = line.split_once(" was banned by ")?;
        let (_source, reason) = rest.split_once(':')?;
        parsed.push((subject.trim().to_owned(), reason.trim().to_owned()));
    }
    (parsed.len() == count).then_some(parsed)
}

fn player_bans(output: &str) -> Option<Vec<PlayerBan>> {
    ban_entries(output)?
        .into_iter()
        .map(|(name, reason)| {
            validate_player(&name).ok()?;
            Some(PlayerBan { name, reason })
        })
        .collect()
}

fn ip_bans(output: &str) -> Option<Vec<IpBan>> {
    ban_entries(output)?
        .into_iter()
        .map(|(ip, reason)| {
            validate_ip(&ip).ok()?;
            Some(IpBan { ip, reason })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bans(players: &str, ips: &str) -> BanLists {
        match response(Query::Bans, vec![players.into(), ips.into()]) {
            QueryResponse::Bans(lists) => lists,
            other => panic!("unexpected {other:?}"),
        }
    }

    fn player_ban(name: &str, reason: &str) -> PlayerBan {
        PlayerBan {
            name: name.into(),
            reason: reason.into(),
        }
    }

    #[test]
    fn list_reads_names_and_max() {
        let parsed = response(
            Query::OnlinePlayers,
            vec!["There are 2 of a max of 20 players online: Steve, Alex".into()],
        );
        assert_eq!(
            parsed,
            QueryResponse::OnlinePlayers(OnlinePlayers {
                output: "There are 2 of a max of 20 players online: Steve, Alex".into(),
                players: vec!["Steve".into(), "Alex".into()],
                max: Some(20),
            })
        );
    }

    #[test]
    fn list_handles_empty_unknown_and_decorated_output() {
        assert_eq!(
            online("There are 0 of a max of 20 players online: "),
            (vec![], Some(20))
        );
        assert_eq!(online("No player list in this response"), (vec![], None));
        assert_eq!(
            online("There are 3 of a max of 10 players online: Steve, [AFK]Alex, @a"),
            (vec!["Steve".to_string()], Some(10))
        );
    }

    fn online(output: &str) -> (Vec<String>, Option<u32>) {
        match response(Query::OnlinePlayers, vec![output.into()]) {
            QueryResponse::OnlinePlayers(list) => (list.players, list.max),
            other => panic!("unexpected {other:?}"),
        }
    }

    #[test]
    fn whitelist_with_and_without_players() {
        let names = |output: &str| match response(Query::Whitelist, vec![output.into()]) {
            QueryResponse::Whitelist(info) => info.players,
            other => panic!("unexpected {other:?}"),
        };
        assert_eq!(
            names("There are 2 whitelisted player(s): Steve, Kai_Builds"),
            vec!["Steve", "Kai_Builds"]
        );
        assert!(names("There are no whitelisted players").is_empty());
    }

    #[test]
    fn banlist_without_bans_is_an_empty_list() {
        let lists = bans("There are no bans", "There are no bans");
        assert_eq!(lists.players, Some(vec![]));
        assert_eq!(lists.ips, Some(vec![]));
    }

    #[test]
    fn banlist_single_entry_without_newline() {
        let lists = bans(
            "There are 1 ban(s):Steve was banned by Server: Banned by an operator.",
            "There are no bans",
        );
        assert_eq!(
            lists.players,
            Some(vec![player_ban("Steve", "Banned by an operator.")])
        );
    }

    #[test]
    fn banlist_multiple_entries_with_newlines() {
        let lists = bans(
            "There are 2 ban(s):\nSteve was banned by Server: griefing\nAlex was banned by Rcon: spam",
            "There are 1 ban(s):\n203.0.113.7 was banned by Server: alt accounts",
        );
        assert_eq!(
            lists.players,
            Some(vec![player_ban("Steve", "griefing"), player_ban("Alex", "spam")])
        );
        assert_eq!(
            lists.ips,
            Some(vec![IpBan {
                ip: "203.0.113.7".into(),
                reason: "alt accounts".into(),
            }])
        );
    }

    #[test]
    fn banlist_multiple_entries_without_newlines_is_unparsed() {
        let lists = bans(
            "There are 2 ban(s):Steve was banned by Server: griefingAlex was banned by Rcon: spam",
            "There are no bans",
        );
        assert_eq!(lists.players, None);
        assert_eq!(
            lists.players_output,
            "There are 2 ban(s):Steve was banned by Server: griefingAlex was banned by Rcon: spam"
        );
    }

    #[test]
    fn banlist_count_mismatch_or_odd_lines_is_unparsed() {
        assert_eq!(
            bans("There are 3 ban(s):\nSteve was banned by Server: a\nAlex was banned by Server: b", "")
                .players,
            None
        );
        assert_eq!(
            bans("There are 1 ban(s):\nsomething unexpected", "").players,
            None
        );
        assert_eq!(
            bans("There are 1 ban(s):\n@a was banned by Server: x", "").players,
            None
        );
        assert_eq!(
            bans("", "There are 1 ban(s):\nnot-an-ip was banned by Server: x").ips,
            None
        );
        assert_eq!(bans("Unknown command", "").players, None);
    }

    #[test]
    fn banlist_serializes_with_camel_case_keys() {
        let json = serde_json::to_value(response(
            Query::Bans,
            vec!["There are no bans".into(), "Unknown command".into()],
        ))
        .unwrap();
        assert_eq!(json["playersOutput"], "There are no bans");
        assert_eq!(json["ipsOutput"], "Unknown command");
        assert_eq!(json["players"], serde_json::json!([]));
        assert!(json["ips"].is_null());
    }
}
