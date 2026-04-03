mod commands;
mod game_scanner;
mod icon_extractor;
mod browser;
mod platform_sync;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::scan_games,
            commands::launch_game,
            commands::add_manual_game,
            commands::extract_icon,
            commands::fetch_image_as_data_url,
            browser::open_browser,
            browser::close_browser_tab,
            browser::navigate_browser,
            browser::go_back,
            browser::go_forward,
            browser::reload_browser,
            browser::get_browser_info,
            browser::inject_scripts_with_permissions,
            browser::navigate_main_window,
            browser::position_browser_window,
            browser::close_embedded_browser,
            platform_sync::connect_platform_command,
            platform_sync::sync_platform_command,
            platform_sync::disconnect_platform_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
