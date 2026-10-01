use std::sync::Mutex;
use std::time::Duration;

use ::rcon::Connection;
use serde::Deserialize;
use tokio::net::TcpStream;
use tokio::time::timeout;

use crate::error::AppError;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const COMMAND_TIMEOUT: Duration = Duration::from_secs(6);
const MAX_SERVER_NAME_CHARS: usize = 60;

#[derive(Clone, Deserialize)]
pub struct ConnectionProfile {
    pub name: String,
    pub host: String,
    pub port: u16,
}

#[derive(Clone)]
pub struct Credentials {
    pub profile: ConnectionProfile,
    pub password: String,
}

/// Credentials live only in this process; cleared on disconnect or exit.
#[derive(Default)]
pub struct SessionState(Mutex<Option<Credentials>>);

impl SessionState {
    pub fn get(&self) -> Result<Credentials, AppError> {
        self.0
            .lock()
            .map_err(|_| AppError::internal("连接状态暂时不可用"))?
            .clone()
            .ok_or_else(|| AppError::disconnected("请先连接服务器"))
    }

    pub fn set(&self, credentials: Option<Credentials>) -> Result<(), AppError> {
        *self
            .0
            .lock()
            .map_err(|_| AppError::internal("连接状态暂时不可用"))? = credentials;
        Ok(())
    }
}

pub fn validate_profile(profile: &ConnectionProfile) -> Result<(), AppError> {
    let name = profile.name.trim();
    if name.is_empty() || name.chars().count() > MAX_SERVER_NAME_CHARS {
        return Err(AppError::invalid("请输入不超过 60 个字符的服务器名称"));
    }
    if profile.host.trim().is_empty()
        || profile.host.len() > 253
        || profile
            .host
            .chars()
            .any(|ch| ch.is_whitespace() || ch.is_control() || ch == '/')
        || profile.port == 0
    {
        return Err(AppError::invalid("请输入有效的 RCON 地址和端口"));
    }
    Ok(())
}

pub async fn open(credentials: &Credentials) -> Result<Connection<TcpStream>, AppError> {
    let address = (credentials.profile.host.as_str(), credentials.profile.port);
    match timeout(
        CONNECT_TIMEOUT,
        Connection::<TcpStream>::connect(address, &credentials.password),
    )
    .await
    {
        Ok(Ok(connection)) => Ok(connection),
        Ok(Err(_)) => Err(AppError::disconnected(
            "无法连接或验证 RCON，请检查网络、端口和密码",
        )),
        Err(_) => Err(AppError::disconnected("RCON 连接超时")),
    }
}

/// Opens one short-lived connection and runs `commands` in order on it.
pub async fn execute(credentials: &Credentials, commands: &[&str]) -> Result<Vec<String>, AppError> {
    let mut connection = open(credentials).await?;
    let mut outputs = Vec::with_capacity(commands.len());
    for command in commands {
        match timeout(COMMAND_TIMEOUT, connection.cmd(command)).await {
            Ok(Ok(output)) => outputs.push(output),
            Ok(Err(_)) | Err(_) => {
                return Err(AppError::unknown(
                    "命令可能已经送达，但没有收到完整回复。请检查游戏状态后再决定是否重试",
                ))
            }
        }
    }
    Ok(outputs)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;
    use tokio::task::JoinHandle;

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

    async fn accept_and_authenticate(listener: TcpListener) -> TcpStream {
        let (mut stream, _) = listener.accept().await.unwrap();
        let (auth_id, auth_type, password) = read_packet(&mut stream).await;
        assert_eq!(auth_type, 3);
        assert_eq!(password, "test-password");
        write_packet(&mut stream, auth_id, 2, "").await;
        stream
    }

    /// A fake RCON server that expects `script` commands in order on one connection.
    async fn mock_server(script: Vec<(&'static str, &'static str)>) -> (u16, JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = tokio::spawn(async move {
            let mut stream = accept_and_authenticate(listener).await;
            for (expected, reply) in script {
                let (command_id, command_type, command) = read_packet(&mut stream).await;
                assert_eq!(command_type, 2);
                assert_eq!(command, expected);
                let (end_id, _, end) = read_packet(&mut stream).await;
                assert!(end.is_empty());
                write_packet(&mut stream, command_id, 0, reply).await;
                write_packet(&mut stream, end_id, 0, "").await;
            }
        });
        (port, server)
    }

    fn credentials(port: u16) -> Credentials {
        Credentials {
            profile: ConnectionProfile {
                name: "Test".into(),
                host: "127.0.0.1".into(),
                port,
            },
            password: "test-password".into(),
        }
    }

    #[tokio::test]
    async fn authenticates_and_reads_one_command() {
        let (port, server) =
            mock_server(vec![("list", "There are 1 of a max of 20 players online: Steve")]).await;
        let outputs = execute(&credentials(port), &["list"]).await.unwrap();
        assert_eq!(outputs, vec!["There are 1 of a max of 20 players online: Steve"]);
        server.await.unwrap();
    }

    #[tokio::test]
    async fn runs_two_commands_on_one_connection() {
        let (port, server) = mock_server(vec![
            ("banlist players", "There are no bans"),
            ("banlist ips", "There are 1 ban(s):\n203.0.113.7 was banned by Server: spam"),
        ])
        .await;
        let outputs = execute(&credentials(port), &["banlist players", "banlist ips"])
            .await
            .unwrap();
        assert_eq!(
            outputs,
            vec![
                "There are no bans",
                "There are 1 ban(s):\n203.0.113.7 was banned by Server: spam"
            ]
        );
        server.await.unwrap();
    }

    #[tokio::test]
    async fn rejected_password_is_disconnected() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            read_packet(&mut stream).await;
            write_packet(&mut stream, -1, 2, "").await;
        });
        let error = execute(&credentials(port), &["list"]).await.unwrap_err();
        assert_eq!(error.kind, "disconnected");
        server.await.unwrap();
    }

    #[tokio::test]
    async fn connection_dropped_after_sending_is_unknown() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = tokio::spawn(async move {
            let mut stream = accept_and_authenticate(listener).await;
            read_packet(&mut stream).await;
            // Drop the stream without replying.
        });
        let error = execute(&credentials(port), &["kick Steve"]).await.unwrap_err();
        assert_eq!(error.kind, "unknown");
        server.await.unwrap();
    }

    #[tokio::test]
    async fn closed_port_is_disconnected() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        drop(listener);
        let error = execute(&credentials(port), &["list"]).await.unwrap_err();
        assert_eq!(error.kind, "disconnected");
    }

    #[test]
    fn shared_fixture_server_names_count_characters() {
        let fixture: Value =
            serde_json::from_str(include_str!("../../tests/fixtures/validation.json")).unwrap();
        let expand = |value: &Value| match value {
            Value::String(text) => text.clone(),
            Value::Object(spec) => spec["repeat"]
                .as_str()
                .unwrap()
                .repeat(spec["times"].as_u64().unwrap() as usize),
            other => panic!("unexpected fixture value {other}"),
        };
        let profile = |name: String| ConnectionProfile {
            name,
            host: "127.0.0.1".into(),
            port: 25575,
        };
        for name in fixture["serverName"]["valid"].as_array().unwrap().iter().map(expand) {
            assert!(validate_profile(&profile(name.clone())).is_ok(), "should accept {name:?}");
        }
        for name in fixture["serverName"]["invalid"].as_array().unwrap().iter().map(expand) {
            assert!(validate_profile(&profile(name.clone())).is_err(), "should reject {name:?}");
        }
    }

    #[test]
    fn host_and_port_are_checked() {
        let profile = |host: &str, port: u16| ConnectionProfile {
            name: "Test".into(),
            host: host.into(),
            port,
        };
        assert!(validate_profile(&profile("192.168.1.10", 25575)).is_ok());
        assert!(validate_profile(&profile("mc.example.com", 25575)).is_ok());
        assert!(validate_profile(&profile("", 25575)).is_err());
        assert!(validate_profile(&profile("host name", 25575)).is_err());
        assert!(validate_profile(&profile("http://host", 25575)).is_err());
        assert!(validate_profile(&profile("192.168.1.10", 0)).is_err());
    }
}
