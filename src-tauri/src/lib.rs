mod commands;
mod console_mode;
mod streaming_addon;
mod game_scanner;
mod icon_extractor;
mod library_cache;
mod browser;
mod library_store;
mod metadata;
mod platform_sync;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            streaming_addon::load_streaming_addon,
            streaming_addon::list_streaming_catalog_addons,
            streaming_addon::streaming_addon_user_plugins_dir,
            streaming_addon::delete_streaming_addon_zip,
            commands::scan_games,
            commands::load_cached_library,
            commands::get_steam_user_id,
            commands::launch_game,
            commands::install_game,
            commands::uninstall_game,
            commands::focus_window_by_pid,
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
            platform_sync::authenticate_platform_command,
            library_store::library_manual_add,
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
            metadata::commands::metadata_fetch_igdb_by_id,
            metadata::commands::metadata_peek_cached_igdb_covers,
            metadata::commands::metadata_tmdb_search,
            metadata::commands::metadata_tmdb_fetch_detail,
            metadata::commands::metadata_tmdb_fetch_watch_providers,
            metadata::commands::metadata_tmdb_discover,
            metadata::commands::metadata_igdb_discover_games,
            metadata::commands::metadata_enrich_all_games,
            console_mode::console_mode_is_supported,
            console_mode::console_mode_get_status,
            console_mode::console_mode_set_launch_at_login,
            console_mode::console_mode_apply_desktop,
            console_mode::console_mode_restore_desktop,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                console_mode::restore_desktop_chrome();
            }
        });
}
