mod action;
mod commands;
mod error;
mod map;
mod parse;
mod rcon;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(rcon::SessionState::default())
        .invoke_handler(tauri::generate_handler![
            commands::connect_rcon,
            commands::reconnect_rcon,
            commands::disconnect_rcon,
            commands::query,
            commands::perform,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
