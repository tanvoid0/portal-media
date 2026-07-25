//! Windows display enumeration and path-level disable/restore via QueryDisplayConfig.

use super::types::DisplayInfo;
use std::sync::Mutex;
use std::sync::OnceLock;

#[cfg(windows)]
use windows::core::PCWSTR;
#[cfg(windows)]
use windows::Win32::Devices::Display::{
    DisplayConfigGetDeviceInfo, GetDisplayConfigBufferSizes, QueryDisplayConfig, SetDisplayConfig,
    DISPLAYCONFIG_DEVICE_INFO_GET_SOURCE_NAME, DISPLAYCONFIG_DEVICE_INFO_HEADER,
    DISPLAYCONFIG_MODE_INFO, DISPLAYCONFIG_PATH_INFO, DISPLAYCONFIG_SOURCE_DEVICE_NAME,
    QDC_ALL_PATHS, QDC_ONLY_ACTIVE_PATHS, SDC_APPLY, SDC_USE_SUPPLIED_DISPLAY_CONFIG,
};
#[cfg(windows)]
use windows::Win32::Foundation::WIN32_ERROR;

#[cfg(windows)]
const PATH_ACTIVE: u32 = 0x00000001;

#[cfg(windows)]
struct DisplaySnapshot {
    paths: Vec<DISPLAYCONFIG_PATH_INFO>,
    modes: Vec<DISPLAYCONFIG_MODE_INFO>,
}

#[cfg(windows)]
static DISPLAY_SNAPSHOT: OnceLock<Mutex<Option<DisplaySnapshot>>> = OnceLock::new();

#[cfg(windows)]
fn snapshot_slot() -> &'static Mutex<Option<DisplaySnapshot>> {
    DISPLAY_SNAPSHOT.get_or_init(|| Mutex::new(None))
}

pub fn list_displays() -> Result<Vec<DisplayInfo>, String> {
    #[cfg(windows)]
    {
        list_displays_win32()
    }
    #[cfg(not(windows))]
    {
        Err("Display automation is only supported on Windows.".into())
    }
}

pub fn disable_displays(indexes: &[u32]) -> Result<(), String> {
    #[cfg(windows)]
    {
        if indexes.is_empty() {
            return Ok(());
        }
        save_display_snapshot()?;
        let mut paths = query_paths(QDC_ALL_PATHS)?;
        let modes = query_modes(QDC_ALL_PATHS, &paths)?;
        let gdi_names = monitor_gdi_names()?;
        let disable: std::collections::HashSet<String> = indexes
            .iter()
            .filter_map(|idx| gdi_names.get(*idx as usize).cloned())
            .collect();
        if disable.is_empty() {
            return Err("No matching displays to disable.".into());
        }

        for path in paths.iter_mut() {
            if let Some(name) = path_source_gdi_name(path, &modes) {
                if disable.contains(&name) {
                    path.flags &= !PATH_ACTIVE;
                }
            }
        }

        apply_paths(&paths, &modes)
    }
    #[cfg(not(windows))]
    {
        let _ = indexes;
        Err("Display automation is only supported on Windows.".into())
    }
}

pub fn restore_displays() -> Result<(), String> {
    #[cfg(windows)]
    {
        let snap = snapshot_slot()
            .lock()
            .map_err(|e| format!("Display snapshot lock poisoned: {e}"))?
            .take();
        let Some(snap) = snap else {
            return Ok(());
        };
        apply_paths(&snap.paths, &snap.modes)
    }
    #[cfg(not(windows))]
    {
        Ok(())
    }
}

#[cfg(windows)]
fn save_display_snapshot() -> Result<(), String> {
    let paths = query_paths(QDC_ONLY_ACTIVE_PATHS)?;
    let modes = query_modes(QDC_ONLY_ACTIVE_PATHS, &paths)?;
    let mut slot = snapshot_slot()
        .lock()
        .map_err(|e| format!("Display snapshot lock poisoned: {e}"))?;
    *slot = Some(DisplaySnapshot { paths, modes });
    Ok(())
}

#[cfg(windows)]
fn list_displays_win32() -> Result<Vec<DisplayInfo>, String> {
    use windows::Win32::Graphics::Gdi::{
        EnumDisplayDevicesW, DISPLAY_DEVICEW, DISPLAY_DEVICE_ACTIVE, DISPLAY_DEVICE_PRIMARY_DEVICE,
    };

    let mut out = Vec::new();
    let mut index: u32 = 0;
    loop {
        let mut device = DISPLAY_DEVICEW::default();
        device.cb = std::mem::size_of::<DISPLAY_DEVICEW>() as u32;
        let ok = unsafe {
            EnumDisplayDevicesW(PCWSTR::null(), index, &mut device, Default::default())
        };
        if !ok.as_bool() {
            break;
        }
        let name = wchar_to_string(&device.DeviceName);
        let flags = device.StateFlags;
        let active = flags & DISPLAY_DEVICE_ACTIVE != 0;
        let primary = flags & DISPLAY_DEVICE_PRIMARY_DEVICE != 0;
        out.push(DisplayInfo {
            index,
            name,
            primary,
            active,
        });
        index += 1;
    }
    Ok(out)
}

#[cfg(windows)]
fn monitor_gdi_names() -> Result<Vec<String>, String> {
    list_displays_win32().map(|v| v.into_iter().map(|d| d.name).collect())
}

#[cfg(windows)]
fn win32_ok(hr: WIN32_ERROR) -> bool {
    hr == WIN32_ERROR(0)
}

#[cfg(windows)]
fn query_paths(
    flags: windows::Win32::Devices::Display::QUERY_DISPLAY_CONFIG_FLAGS,
) -> Result<Vec<DISPLAYCONFIG_PATH_INFO>, String> {
    let (mut path_count, mut mode_count) = (0u32, 0u32);
    let hr = unsafe { GetDisplayConfigBufferSizes(flags, &mut path_count, &mut mode_count) };
    if !win32_ok(hr) {
        return Err(format!("GetDisplayConfigBufferSizes failed: {:?}", hr));
    }
    let mut paths = vec![DISPLAYCONFIG_PATH_INFO::default(); path_count as usize];
    let mut modes = vec![DISPLAYCONFIG_MODE_INFO::default(); mode_count as usize];
    let hr = unsafe {
        QueryDisplayConfig(
            flags,
            &mut path_count,
            paths.as_mut_ptr(),
            &mut mode_count,
            modes.as_mut_ptr(),
            None,
        )
    };
    if !win32_ok(hr) {
        return Err(format!("QueryDisplayConfig failed: {:?}", hr));
    }
    paths.truncate(path_count as usize);
    Ok(paths)
}

#[cfg(windows)]
fn query_modes(
    flags: windows::Win32::Devices::Display::QUERY_DISPLAY_CONFIG_FLAGS,
    paths: &[DISPLAYCONFIG_PATH_INFO],
) -> Result<Vec<DISPLAYCONFIG_MODE_INFO>, String> {
    let (mut path_count, mut mode_count) = (paths.len() as u32, 0u32);
    let hr = unsafe { GetDisplayConfigBufferSizes(flags, &mut path_count, &mut mode_count) };
    if !win32_ok(hr) {
        return Err(format!("GetDisplayConfigBufferSizes (modes) failed: {:?}", hr));
    }
    let mut modes = vec![DISPLAYCONFIG_MODE_INFO::default(); mode_count as usize];
    let mut path_buf = paths.to_vec();
    let hr = unsafe {
        QueryDisplayConfig(
            flags,
            &mut path_count,
            path_buf.as_mut_ptr(),
            &mut mode_count,
            modes.as_mut_ptr(),
            None,
        )
    };
    if !win32_ok(hr) {
        return Err(format!("QueryDisplayConfig (modes) failed: {:?}", hr));
    }
    modes.truncate(mode_count as usize);
    Ok(modes)
}

#[cfg(windows)]
fn apply_paths(paths: &[DISPLAYCONFIG_PATH_INFO], modes: &[DISPLAYCONFIG_MODE_INFO]) -> Result<(), String> {
    let hr = unsafe {
        SetDisplayConfig(
            Some(paths),
            Some(modes),
            SDC_APPLY | SDC_USE_SUPPLIED_DISPLAY_CONFIG,
        )
    };
    if hr != 0 {
        return Err(format!("SetDisplayConfig failed: {hr}"));
    }
    Ok(())
}

#[cfg(windows)]
fn path_source_gdi_name(
    path: &DISPLAYCONFIG_PATH_INFO,
    modes: &[DISPLAYCONFIG_MODE_INFO],
) -> Option<String> {
    let mode_idx = unsafe { path.sourceInfo.Anonymous.modeInfoIdx } as usize;
    let mode = modes.get(mode_idx)?;
    let header = DISPLAYCONFIG_DEVICE_INFO_HEADER {
        r#type: DISPLAYCONFIG_DEVICE_INFO_GET_SOURCE_NAME,
        size: std::mem::size_of::<DISPLAYCONFIG_SOURCE_DEVICE_NAME>() as u32,
        adapterId: mode.adapterId,
        id: mode.id,
    };
    let mut source = DISPLAYCONFIG_SOURCE_DEVICE_NAME {
        header,
        viewGdiDeviceName: [0; 32],
    };
    let hr = unsafe { DisplayConfigGetDeviceInfo(&mut source.header) };
    if hr != 0 {
        return None;
    }
    Some(wchar_to_string(&source.viewGdiDeviceName))
}

#[cfg(windows)]
fn wchar_to_string(buf: &[u16]) -> String {
    let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    String::from_utf16_lossy(&buf[..len])
}
