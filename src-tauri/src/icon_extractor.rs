#[cfg(target_os = "windows")]
pub fn extract_icon_from_exe(_path: &std::path::Path) -> Option<String> {
    // For now, return None - icon extraction is complex and requires careful Windows API handling
    // This can be implemented later with proper error handling
    // The frontend will fall back to default icons
    None
}

#[cfg(not(target_os = "windows"))]
pub fn extract_icon_from_exe(_path: &std::path::Path) -> Option<String> {
    None
}

#[cfg(target_os = "windows")]
pub fn extract_icon_from_lnk(_path: &std::path::Path) -> Option<String> {
    // Try to resolve the shortcut target and extract icon from that
    // For now, return None - can be enhanced later
    None
}

#[cfg(not(target_os = "windows"))]
pub fn extract_icon_from_lnk(_path: &std::path::Path) -> Option<String> {
    None
}

