mod automation;
mod commands;
mod console_mode;
mod focus_watchdog;
mod native_gamepad;
mod session_recovery;
mod winlogon_shell;
mod streaming_addon;
mod game_scanner;
mod icon_extractor;
mod shell_link;
mod library_cache;
mod browser;
mod library_store;
mod metadata;
mod platform_auth;
mod platform_sync;
mod save_sync;
mod spotify;

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
            streaming_addon::launch_streaming_addon_app,
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
            console_mode::enable_console_mode,
            console_mode::disable_console_mode,
            console_mode::console_mode_apply_desktop,
            console_mode::console_mode_restore_desktop,
            console_mode::shell_hotkeys_set_enabled,
            winlogon_shell::winlogon_shell_is_supported,
            winlogon_shell::winlogon_shell_get_status,
            winlogon_shell::winlogon_shell_set_enabled,
            winlogon_shell::winlogon_shell_set_revert_on_next_launch,
            session_recovery::recover_desktop_session,
            session_recovery::request_app_exit,
            session_recovery::power_action,
            focus_watchdog::focus_watchdog_is_supported,
            focus_watchdog::focus_watchdog_set_enabled,
            focus_watchdog::focus_watchdog_sync_tracked_pids,
            focus_watchdog::is_process_running,
            focus_watchdog::focus_portal_main_window,
            native_gamepad::native_gamepad_set_prefs,
            native_gamepad::native_cursor_set_browser_active,
            automation::automation_is_supported,
            automation::automation_list_displays,
            automation::automation_list_audio_devices,
            automation::automation_get_config,
            automation::automation_save_config,
            automation::automation_apply_launch,
            automation::automation_register_game_pid,
            automation::automation_apply_exit,
            save_sync::save_sync_get_status,
            save_sync::save_sync_save_config,
            save_sync::save_sync_sign_in,
            save_sync::save_sync_sign_out,
            save_sync::save_sync_discover,
            save_sync::save_sync_discover_for_game,
            save_sync::save_sync_preview_plan,
            save_sync::save_sync_run,
            save_sync::save_sync_resolve_conflict,
            spotify::commands::spotify_start_auth,
            spotify::commands::spotify_check_auth,
            spotify::commands::spotify_disconnect,
            spotify::commands::spotify_is_configured,
            spotify::commands::spotify_get_client_id,
            spotify::commands::spotify_get_access_token,
            spotify::commands::spotify_get_me,
            spotify::commands::spotify_get_playback_state,
            spotify::commands::spotify_play,
            spotify::commands::spotify_pause,
            spotify::commands::spotify_next,
            spotify::commands::spotify_previous,
            spotify::commands::spotify_seek,
            spotify::commands::spotify_set_volume,
            spotify::commands::spotify_set_shuffle,
            spotify::commands::spotify_set_repeat,
            spotify::commands::spotify_get_devices,
            spotify::commands::spotify_transfer_playback,
            spotify::commands::spotify_get_playlists,
            spotify::commands::spotify_get_playlist_tracks,
            spotify::commands::spotify_get_liked_songs,
            spotify::commands::spotify_get_saved_albums,
            spotify::commands::spotify_get_followed_artists,
            spotify::commands::spotify_get_top_tracks,
            spotify::commands::spotify_get_top_artists,
            spotify::commands::spotify_get_recently_played,
            spotify::commands::spotify_get_album,
            spotify::commands::spotify_get_artist,
            spotify::commands::spotify_get_artist_top_tracks,
            spotify::commands::spotify_get_artist_albums,
            spotify::commands::spotify_search,
            spotify::commands::spotify_like_track,
            spotify::commands::spotify_unlike_track,
            spotify::commands::spotify_check_liked_tracks,
        ])
        .setup(|app| {
            console_mode::setup(app)?;
            winlogon_shell::setup(app)?;
            focus_watchdog::setup(app)?;
            native_gamepad::setup(app)?;
            automation::setup(app)?;
            session_recovery::setup(app)?;
            session_recovery::attach_close_recovery(app.handle());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            match event {
                tauri::RunEvent::Exit => session_recovery::recover_on_app_exit(),
                tauri::RunEvent::WindowEvent { event, .. } => {
                    if let tauri::WindowEvent::CloseRequested { .. } = event {
                        session_recovery::recover_on_app_exit();
                    }
                    let _ = app_handle;
                }
                _ => {}
            }
        });
}
