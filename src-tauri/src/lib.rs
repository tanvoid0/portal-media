mod commands;
mod game_scanner;
mod icon_extractor;
mod browser;
mod metadata;
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
            metadata::commands::metadata_get_provider_status,
            metadata::commands::metadata_save_igdb_credentials,
            metadata::commands::metadata_clear_igdb_credentials,
            metadata::commands::metadata_save_tmdb_api_key,
            metadata::commands::metadata_clear_tmdb_api_key,
            metadata::commands::metadata_test_igdb,
            metadata::commands::metadata_test_igdb_credentials,
            metadata::commands::metadata_test_tmdb,
            metadata::commands::metadata_test_tmdb_key,
            metadata::commands::metadata_clear_cache,
            metadata::commands::metadata_fetch_igdb_for_game,
            metadata::commands::metadata_tmdb_search,
            metadata::commands::metadata_tmdb_fetch_detail,
            metadata::commands::metadata_enrich_all_games,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
