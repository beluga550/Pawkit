mod map;
mod server;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(server::SessionState::default())
        .invoke_handler(tauri::generate_handler![
            server::connect_rcon,
            server::reconnect_rcon,
            server::disconnect_rcon,
            server::list_players,
            server::broadcast,
            server::teleport_to_player,
            server::teleport_to_coords,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
