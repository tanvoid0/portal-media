//! Resolve Windows `.lnk` shortcuts to their target path (exe, bat, another lnk, …).

#[cfg(target_os = "windows")]
use std::path::{Path, PathBuf};

/// Ordered paths to try when extracting an icon (shortcut shell icon, then target binary).
#[cfg(target_os = "windows")]
pub fn icon_source_candidates(launch_path: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    let mut push_unique = |p: PathBuf| {
        if p.is_file() && !out.iter().any(|x| x == &p) {
            out.push(p);
        }
    };

    push_unique(launch_path.to_path_buf());

    if launch_path.extension().and_then(|e| e.to_str()) == Some("lnk") {
        if let Some(target) = resolve_shortcut_target(launch_path) {
            push_unique(target);
        }
    }

    out
}

/// Resolve a `.lnk` file to its target filesystem path, if possible.
#[cfg(target_os = "windows")]
pub fn resolve_shortcut_target(lnk_path: &Path) -> Option<PathBuf> {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::{Interface, PCWSTR};
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoUninitialize, IPersistFile, CLSCTX_INPROC_SERVER,
        COINIT_APARTMENTTHREADED, STGM_READ,
    };
    use windows::Win32::UI::Shell::{IShellLinkW, ShellLink, SLGP_RAWPATH};

    if lnk_path.extension().and_then(|e| e.to_str()) != Some("lnk") {
        return None;
    }
    if !lnk_path.is_file() {
        return None;
    }

    unsafe {
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
    }

    let result = (|| {
        let link: IShellLinkW =
            unsafe { CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER) }.ok()?;
        let persist: IPersistFile = link.cast().ok()?;
        let wide: Vec<u16> = lnk_path
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        unsafe { persist.Load(PCWSTR(wide.as_ptr()), STGM_READ) }.ok()?;

        let mut buf = vec![0u16; 32768];
        let mut find_data =
            windows::Win32::Storage::FileSystem::WIN32_FIND_DATAW::default();
        unsafe {
            link.GetPath(&mut buf, &mut find_data, SLGP_RAWPATH.0 as u32)
        }
        .ok()?;

        let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
        let path = PathBuf::from(String::from_utf16_lossy(&buf[..len]));
        if path.as_os_str().is_empty() {
            return None;
        }
        Some(path)
    })();

    unsafe {
        CoUninitialize();
    }

    result.filter(|p| !p.as_os_str().is_empty())
}

#[cfg(not(target_os = "windows"))]
pub fn icon_source_candidates(launch_path: &Path) -> Vec<std::path::PathBuf> {
    if launch_path.is_file() {
        vec![launch_path.to_path_buf()]
    } else {
        vec![]
    }
}

#[cfg(not(target_os = "windows"))]
pub fn resolve_shortcut_target(_lnk_path: &Path) -> Option<std::path::PathBuf> {
    None
}
