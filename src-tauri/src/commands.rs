use tauri::State;

use crate::action::{Action, Query};
use crate::error::AppError;
use crate::parse::{self, QueryResponse};
use crate::rcon::{self, ConnectionProfile, Credentials, SessionState};

#[tauri::command]
pub async fn connect_rcon(
    state: State<'_, SessionState>,
    profile: ConnectionProfile,
    password: String,
) -> Result<(), AppError> {
    rcon::validate_profile(&profile)?;
    if password.is_empty() || password.contains('\0') {
        return Err(AppError::invalid("请输入 RCON 密码"));
    }
    let credentials = Credentials { profile, password };
    rcon::open(&credentials).await?;
    state.set(Some(credentials))
}

#[tauri::command]
pub async fn reconnect_rcon(state: State<'_, SessionState>) -> Result<(), AppError> {
    rcon::open(&state.get()?).await?;
    Ok(())
}

#[tauri::command]
pub fn disconnect_rcon(state: State<'_, SessionState>) -> Result<(), AppError> {
    state.set(None)
}

#[tauri::command]
pub async fn query(
    state: State<'_, SessionState>,
    query: Query,
) -> Result<QueryResponse, AppError> {
    let outputs = rcon::execute(&state.get()?, query.commands()).await?;
    Ok(parse::response(query, outputs))
}

/// Runs exactly once. Never retried here or in the frontend.
#[tauri::command]
pub async fn perform(state: State<'_, SessionState>, action: Action) -> Result<String, AppError> {
    let command = action.command()?;
    let mut outputs = rcon::execute(&state.get()?, &[command.as_str()]).await?;
    Ok(outputs.remove(0))
}
