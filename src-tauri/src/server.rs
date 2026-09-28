use std::sync::Mutex;
use std::time::Duration;

use rcon::Connection;
use serde::{Deserialize, Serialize};
use tauri::State;
use tokio::net::TcpStream;
use tokio::time::timeout;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const COMMAND_TIMEOUT: Duration = Duration::from_secs(6);

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionProfile {
    name: String,
    host: String,
    port: u16,
}

#[derive(Clone)]
struct Credentials {
    profile: ConnectionProfile,
    password: String,
}

#[derive(Default)]
pub struct SessionState(Mutex<Option<Credentials>>);

#[derive(Debug, Serialize)]
pub struct AppError {
    kind: &'static str,
    message: String,
}

impl AppError {
    fn new(kind: &'static str, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
        }
    }
}

#[derive(Serialize)]
pub struct ListResponse {
    output: String,
    players: Vec<String>,
}

#[derive(Deserialize)]
pub struct PlayerTeleport {
    source: String,
    destination: String,
}

#[derive(Deserialize)]
pub struct CoordinateTeleport {
    player: String,
    x: f64,
    y: f64,
    z: f64,
}

fn validate_profile(profile: &ConnectionProfile) -> Result<(), AppError> {
    if profile.name.trim().is_empty() || profile.name.len() > 60 {
        return Err(AppError::new(
            "invalid_input",
            "请输入不超过 60 个字符的服务器名称",
        ));
    }
    if profile.host.trim().is_empty()
        || profile.host.len() > 253
        || profile
            .host
            .chars()
            .any(|ch| ch.is_whitespace() || ch.is_control() || ch == '/')
        || profile.port == 0
    {
        return Err(AppError::new(
            "invalid_input",
            "请输入有效的 RCON 地址和端口",
        ));
    }
    Ok(())
}

fn validate_player(player: &str) -> Result<&str, AppError> {
    if (3..=16).contains(&player.len())
        && player
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
    {
        Ok(player)
    } else {
        Err(AppError::new(
            "invalid_input",
            "玩家名只能包含 3–16 位英文字母、数字或下划线；不支持 @a 等选择器",
        ))
    }
}

fn say_command(message: &str) -> Result<String, AppError> {
    let message = message.trim();
    if message.is_empty() || message.chars().count() > 256 || message.chars().any(char::is_control)
    {
        return Err(AppError::new(
            "invalid_input",
            "广播内容必须是 1–256 字符的单行文字",
        ));
    }
    Ok(format!("say {message}"))
}

fn player_teleport_command(request: &PlayerTeleport) -> Result<String, AppError> {
    let source = validate_player(&request.source)?;
    let destination = validate_player(&request.destination)?;
    if source == destination {
        return Err(AppError::new("invalid_input", "起点和目的地不能是同一玩家"));
    }
    Ok(format!("tp {source} {destination}"))
}

fn coordinate_teleport_command(request: &CoordinateTeleport) -> Result<String, AppError> {
    let player = validate_player(&request.player)?;
    if [request.x, request.y, request.z]
        .iter()
        .any(|value| !value.is_finite() || value.abs() > 29_999_984.0)
    {
        return Err(AppError::new(
            "invalid_input",
            "坐标必须是世界边界内的有限数字",
        ));
    }
    Ok(format!(
        "execute in minecraft:overworld run tp {player} {} {} {}",
        request.x, request.y, request.z
    ))
}

fn credentials(state: &State<'_, SessionState>) -> Result<Credentials, AppError> {
    state
        .inner()
        .0
        .lock()
        .map_err(|_| AppError::new("internal", "连接状态暂时不可用"))?
        .clone()
        .ok_or_else(|| AppError::new("disconnected", "请先连接服务器"))
}

async fn open(credentials: &Credentials) -> Result<Connection<TcpStream>, AppError> {
    let address = (credentials.profile.host.as_str(), credentials.profile.port);
    match timeout(
        CONNECT_TIMEOUT,
        Connection::<TcpStream>::connect(address, &credentials.password),
    )
    .await
    {
        Ok(Ok(connection)) => Ok(connection),
        Ok(Err(_)) => Err(AppError::new(
            "disconnected",
            "无法连接或验证 RCON，请检查网络、端口和密码",
        )),
        Err(_) => Err(AppError::new("disconnected", "RCON 连接超时")),
    }
}

async fn execute(state: State<'_, SessionState>, command: String) -> Result<String, AppError> {
    let credentials = credentials(&state)?;
    let mut connection = open(&credentials).await?;
    match timeout(COMMAND_TIMEOUT, connection.cmd(&command)).await {
        Ok(Ok(output)) => Ok(output),
        Ok(Err(_)) | Err(_) => Err(AppError::new(
            "unknown",
            "命令可能已经送达，但没有收到完整回复。请检查游戏状态后再决定是否重试",
        )),
    }
}

fn parse_players(output: &str) -> Vec<String> {
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

#[tauri::command]
pub async fn connect_rcon(
    state: State<'_, SessionState>,
    profile: ConnectionProfile,
    password: String,
) -> Result<(), AppError> {
    validate_profile(&profile)?;
    if password.is_empty() || password.contains('\0') {
        return Err(AppError::new("invalid_input", "请输入 RCON 密码"));
    }
    let credentials = Credentials { profile, password };
    open(&credentials).await?;
    *state
        .inner()
        .0
        .lock()
        .map_err(|_| AppError::new("internal", "连接状态暂时不可用"))? = Some(credentials);
    Ok(())
}

#[tauri::command]
pub async fn reconnect_rcon(state: State<'_, SessionState>) -> Result<(), AppError> {
    let credentials = credentials(&state)?;
    open(&credentials).await?;
    Ok(())
}

#[tauri::command]
pub fn disconnect_rcon(state: State<'_, SessionState>) -> Result<(), AppError> {
    *state
        .inner()
        .0
        .lock()
        .map_err(|_| AppError::new("internal", "连接状态暂时不可用"))? = None;
    Ok(())
}

#[tauri::command]
pub async fn list_players(state: State<'_, SessionState>) -> Result<ListResponse, AppError> {
    let output = execute(state, "list".to_owned()).await?;
    let players = parse_players(&output);
    Ok(ListResponse { output, players })
}

#[tauri::command]
pub async fn broadcast(
    state: State<'_, SessionState>,
    message: String,
) -> Result<String, AppError> {
    execute(state, say_command(&message)?).await
}

#[tauri::command]
pub async fn teleport_to_player(
    state: State<'_, SessionState>,
    request: PlayerTeleport,
) -> Result<String, AppError> {
    execute(state, player_teleport_command(&request)?).await
}

#[tauri::command]
pub async fn teleport_to_coords(
    state: State<'_, SessionState>,
    request: CoordinateTeleport,
) -> Result<String, AppError> {
    execute(state, coordinate_teleport_command(&request)?).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    async fn read_packet(stream: &mut TcpStream) -> (i32, i32, String) {
        let length = stream.read_i32_le().await.unwrap() as usize;
        let mut body = vec![0; length];
        stream.read_exact(&mut body).await.unwrap();
        let id = i32::from_le_bytes(body[0..4].try_into().unwrap());
        let packet_type = i32::from_le_bytes(body[4..8].try_into().unwrap());
        let text = String::from_utf8(body[8..length - 2].to_vec()).unwrap();
        (id, packet_type, text)
    }

    async fn write_packet(stream: &mut TcpStream, id: i32, packet_type: i32, text: &str) {
        let length = (10 + text.len() as i32).to_le_bytes();
        stream.write_all(&length).await.unwrap();
        stream.write_all(&id.to_le_bytes()).await.unwrap();
        stream.write_all(&packet_type.to_le_bytes()).await.unwrap();
        stream.write_all(text.as_bytes()).await.unwrap();
        stream.write_all(&[0, 0]).await.unwrap();
    }

    #[tokio::test]
    async fn rcon_connection_authenticates_and_reads_command_response() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let (auth_id, auth_type, password) = read_packet(&mut stream).await;
            assert_eq!(auth_type, 3);
            assert_eq!(password, "test-password");
            write_packet(&mut stream, auth_id, 2, "").await;
            let (command_id, command_type, command) = read_packet(&mut stream).await;
            assert_eq!(command_type, 2);
            assert_eq!(command, "list");
            let (end_id, _, end_command) = read_packet(&mut stream).await;
            assert!(end_command.is_empty());
            write_packet(
                &mut stream,
                command_id,
                0,
                "There are 1 of a max of 20 players online: Steve",
            )
            .await;
            write_packet(&mut stream, end_id, 0, "").await;
        });

        let credentials = Credentials {
            profile: ConnectionProfile {
                name: "Test".into(),
                host: "127.0.0.1".into(),
                port,
            },
            password: "test-password".into(),
        };
        let mut connection = open(&credentials).await.unwrap();
        let output = connection.cmd("list").await.unwrap();
        assert_eq!(parse_players(&output), vec!["Steve"]);
        server.await.unwrap();
    }

    #[test]
    fn player_input_cannot_expand_to_selectors_or_commands() {
        assert!(validate_player("Steve_123").is_ok());
        assert!(validate_player("@a").is_err());
        assert!(validate_player("Steve\nstop").is_err());
        assert!(say_command("hello\nstop").is_err());
    }

    #[test]
    fn teleport_commands_are_built_from_validated_fields() {
        let to_player = PlayerTeleport {
            source: "Steve".into(),
            destination: "Alex".into(),
        };
        assert_eq!(
            player_teleport_command(&to_player).unwrap(),
            "tp Steve Alex"
        );

        let to_coords = CoordinateTeleport {
            player: "Steve".into(),
            x: 12.5,
            y: 64.0,
            z: -30.0,
        };
        assert_eq!(
            coordinate_teleport_command(&to_coords).unwrap(),
            "execute in minecraft:overworld run tp Steve 12.5 64 -30"
        );
    }

    #[test]
    fn list_parsing_keeps_only_literal_player_names() {
        assert_eq!(
            parse_players("There are 2 of a max of 20 players online: Steve, Alex"),
            vec!["Steve", "Alex"]
        );
        assert!(parse_players("No player list in this response").is_empty());
    }
}
