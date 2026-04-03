#[cfg(target_os = "windows")]
pub fn extract_icon_from_exe(path: &std::path::Path) -> Option<String> {
    shell_path_icon_data_url(path)
}

/// Raw PNG bytes for disk cache / embedding.
#[cfg(target_os = "windows")]
pub fn extract_shell_path_icon_png_bytes(path: &std::path::Path) -> Option<Vec<u8>> {
    let abs = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    try_shell_item_image_bytes(&abs).or_else(|| try_shgetfileinfo_bytes(&abs))
}

#[cfg(not(target_os = "windows"))]
pub fn extract_shell_path_icon_png_bytes(_path: &std::path::Path) -> Option<Vec<u8>> {
    None
}

/// Target extraction size (matches common Windows “jumbo” / high-DPI icon assets).
#[cfg(target_os = "windows")]
const ICON_EXTRACT_SIZE_PX: i32 = 256;

#[cfg(target_os = "windows")]
fn shell_path_icon_data_url(path: &std::path::Path) -> Option<String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    let bytes = extract_shell_path_icon_png_bytes(path)?;
    Some(format!(
        "data:image/png;base64,{}",
        STANDARD.encode(bytes)
    ))
}

/// Prefer `IShellItemImageFactory` so the shell can return a large, crisp icon instead of ~32×32.
#[cfg(target_os = "windows")]
fn try_shell_item_image_bytes(abs: &std::path::Path) -> Option<Vec<u8>> {
    use std::os::windows::ffi::OsStrExt;
    use windows::Win32::Foundation::SIZE;
    use windows::Win32::Graphics::Gdi::DeleteObject;
    use windows::Win32::System::Com::{CoInitializeEx, IBindCtx, COINIT_APARTMENTTHREADED};
    use windows::Win32::UI::Shell::{
        IShellItem, IShellItemImageFactory, SHCreateItemFromParsingName, SIIGBF_BIGGERSIZEOK,
        SIIGBF_ICONONLY, SIIGBF_SCALEUP,
    };
    use windows::core::{Interface, PCWSTR};

    unsafe {
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
    }

    let wide: Vec<u16> = abs
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let item: IShellItem = unsafe {
        SHCreateItemFromParsingName(PCWSTR(wide.as_ptr()), None::<&IBindCtx>).ok()?
    };
    let factory: IShellItemImageFactory = item.cast().ok()?;
    let size = SIZE {
        cx: ICON_EXTRACT_SIZE_PX,
        cy: ICON_EXTRACT_SIZE_PX,
    };
    let flags = SIIGBF_ICONONLY | SIIGBF_BIGGERSIZEOK | SIIGBF_SCALEUP;

    let hbitmap = unsafe { factory.GetImage(size, flags).ok()? };
    let png = unsafe { hbitmap_to_png_bytes(hbitmap) };
    unsafe {
        let _ = DeleteObject(hbitmap);
    }
    png
}

#[cfg(target_os = "windows")]
fn try_shgetfileinfo_bytes(abs: &std::path::Path) -> Option<Vec<u8>> {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::PCWSTR;
    use windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES;
    use windows::Win32::UI::Shell::{SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON};
    use windows::Win32::UI::WindowsAndMessaging::DestroyIcon;

    let wide: Vec<u16> = abs
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut shfi = SHFILEINFOW::default();
    let ret = unsafe {
        SHGetFileInfoW(
            PCWSTR(wide.as_ptr()),
            FILE_FLAGS_AND_ATTRIBUTES(0),
            Some(&mut shfi),
            std::mem::size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON,
        )
    };
    if ret == 0 || shfi.hIcon.is_invalid() {
        return None;
    }

    let hicon = shfi.hIcon;
    let png = unsafe { hicon_to_png_bytes_from_icon(hicon) };
    unsafe {
        let _ = DestroyIcon(hicon);
    }
    png
}

#[cfg(target_os = "windows")]
unsafe fn hbitmap_to_png_bytes(hbmp: windows::Win32::Graphics::Gdi::HBITMAP) -> Option<Vec<u8>> {
    use std::ffi::c_void;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Gdi::{
        CreateCompatibleDC, DeleteDC, GetDC, GetDIBits, GetObjectW, ReleaseDC, SelectObject, BITMAP,
        BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HGDIOBJ, RGBQUAD,
    };

    let mut bm = BITMAP::default();
    if GetObjectW(
        HGDIOBJ(hbmp.0),
        std::mem::size_of::<BITMAP>() as i32,
        Some(&mut bm as *mut _ as *mut c_void),
    ) == 0
    {
        return None;
    }
    if bm.bmWidth <= 0 || bm.bmHeight == 0 {
        return None;
    }
    let w = bm.bmWidth as u32;
    let h = bm.bmHeight as u32;

    let hdc_screen = GetDC(HWND::default());
    if hdc_screen.is_invalid() {
        return None;
    }
    let hdc_mem = CreateCompatibleDC(hdc_screen);
    if hdc_mem.is_invalid() {
        let _ = ReleaseDC(HWND::default(), hdc_screen);
        return None;
    }
    let old = SelectObject(hdc_mem, hbmp);

    let mut bmi = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: bm.bmWidth,
            biHeight: -bm.bmHeight,
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        },
        bmiColors: [RGBQUAD::default(); 1],
    };
    let mut buf = vec![0u8; (w * h * 4) as usize];
    let lines = GetDIBits(
        hdc_mem,
        hbmp,
        0,
        h,
        Some(buf.as_mut_ptr() as *mut c_void),
        &mut bmi,
        DIB_RGB_COLORS,
    );

    let _ = SelectObject(hdc_mem, old);
    let _ = DeleteDC(hdc_mem);
    let _ = ReleaseDC(HWND::default(), hdc_screen);

    if lines == 0 {
        return None;
    }
    for chunk in buf.chunks_exact_mut(4) {
        chunk.swap(0, 2);
    }
    encode_png(w, h, &buf)
}

#[cfg(target_os = "windows")]
unsafe fn hicon_to_png_bytes_from_icon(
    hicon: windows::Win32::UI::WindowsAndMessaging::HICON,
) -> Option<Vec<u8>> {
    use std::ffi::c_void;
    use std::ptr::null_mut;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Gdi::{
        CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, GetDC, ReleaseDC, SelectObject,
        BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HGDIOBJ, RGBQUAD,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        DrawIconEx, GetSystemMetrics, DI_NORMAL, SM_CXICON, SM_CYICON,
    };

    let cx = GetSystemMetrics(SM_CXICON);
    let cy = GetSystemMetrics(SM_CYICON);
    if cx <= 0 || cy <= 0 {
        return None;
    }

    let bmi = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: cx,
            biHeight: -cy,
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        },
        bmiColors: [RGBQUAD::default(); 1],
    };

    let mut bits: *mut c_void = null_mut();
    let hdc_screen = GetDC(HWND::default());
    if hdc_screen.is_invalid() {
        return None;
    }

    let hbitmap = match CreateDIBSection(hdc_screen, &bmi, DIB_RGB_COLORS, &mut bits, None, 0) {
        Ok(h) => h,
        Err(_) => {
            let _ = ReleaseDC(HWND::default(), hdc_screen);
            return None;
        }
    };

    let hdc_mem = CreateCompatibleDC(hdc_screen);
    if hdc_mem.is_invalid() {
        let _ = DeleteObject(hbitmap);
        let _ = ReleaseDC(HWND::default(), hdc_screen);
        return None;
    }

    let old: HGDIOBJ = SelectObject(hdc_mem, hbitmap);
    let len = (cx * cy * 4) as usize;
    if !bits.is_null() {
        std::ptr::write_bytes(bits as *mut u8, 0, len);
    }

    if DrawIconEx(
        hdc_mem,
        0,
        0,
        hicon,
        cx,
        cy,
        0,
        windows::Win32::Graphics::Gdi::HBRUSH::default(),
        DI_NORMAL,
    )
    .is_err()
    {
        let _ = SelectObject(hdc_mem, old);
        let _ = DeleteDC(hdc_mem);
        let _ = DeleteObject(hbitmap);
        let _ = ReleaseDC(HWND::default(), hdc_screen);
        return None;
    }

    let mut rgba = vec![0u8; len];
    if !bits.is_null() {
        std::ptr::copy_nonoverlapping(bits as *const u8, rgba.as_mut_ptr(), len);
    }
    for chunk in rgba.chunks_exact_mut(4) {
        chunk.swap(0, 2);
    }

    let _ = SelectObject(hdc_mem, old);
    let _ = DeleteDC(hdc_mem);
    let _ = DeleteObject(hbitmap);
    let _ = ReleaseDC(HWND::default(), hdc_screen);

    encode_png(cx as u32, cy as u32, &rgba)
}

#[cfg(target_os = "windows")]
fn encode_png(width: u32, height: u32, rgba: &[u8]) -> Option<Vec<u8>> {
    use std::io::Cursor;
    let mut out = Cursor::new(Vec::new());
    let mut enc = png::Encoder::new(&mut out, width, height);
    enc.set_color(png::ColorType::Rgba);
    enc.set_depth(png::BitDepth::Eight);
    let mut writer = enc.write_header().ok()?;
    writer.write_image_data(rgba).ok()?;
    writer.finish().ok()?;
    Some(out.into_inner())
}

#[cfg(not(target_os = "windows"))]
pub fn extract_icon_from_exe(_path: &std::path::Path) -> Option<String> {
    None
}

