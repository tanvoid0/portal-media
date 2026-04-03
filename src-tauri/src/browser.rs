use serde::{Deserialize, Serialize};
use tauri::{command, AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use std::collections::HashMap;
use std::sync::{Mutex, LazyLock};
use url::Url;

#[derive(Debug, Serialize, Deserialize)]
pub struct BrowserTabInfo {
    pub id: String,
    pub url: String,
    pub title: String,
    pub can_go_back: bool,
    pub can_go_forward: bool,
}

static BROWSER_WINDOWS: LazyLock<Mutex<HashMap<String, String>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

/// Base URL for the bundled UI (`devUrl`, `frontendDist` URL, or Tauri's default app protocol).
fn app_entry_base_url(app: &AppHandle) -> Result<Url, String> {
    let config = app.config();
    if let Some(dev_url) = config.build.dev_url.as_ref() {
        return Ok(dev_url.clone());
    }
    match config.build.frontend_dist.as_ref() {
        Some(tauri::utils::config::FrontendDist::Url(url)) => Ok(url.clone()),
        _ => {
            #[cfg(any(windows, target_os = "android"))]
            {
                Url::parse("http://tauri.localhost").map_err(|e| format!("Invalid URL: {}", e))
            }
            #[cfg(not(any(windows, target_os = "android")))]
            {
                Url::parse("tauri://localhost").map_err(|e| format!("Invalid URL: {}", e))
            }
        }
    }
}

fn resolve_navigate_url(app: &AppHandle, url: &str) -> Result<Url, String> {
    let trimmed = url.trim();
    if trimmed == "index.html" || trimmed == "/index.html" {
        return app_entry_base_url(app);
    }
    Url::parse(trimmed).map_err(|e| format!("Invalid URL: {}", e))
}

fn inject_cookie_denial_script(webview: &tauri::WebviewWindow, allow_cookies: bool) {
    if allow_cookies {
        return; // Don't inject if cookies are allowed
    }
    
    let cookie_script = r#"
        (function() {
            function denyCookies() {
                const allButtons = document.querySelectorAll('button, a, [role="button"], [onclick]');
                for (const btn of allButtons) {
                    const text = (btn.textContent || '').toLowerCase();
                    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                    const combined = text + ' ' + ariaLabel;
                    
                    if (combined.includes('reject') || combined.includes('deny') || 
                        combined.includes('decline') || combined.includes('refuse') ||
                        combined.includes('not accept') || combined.includes("don't accept") ||
                        combined.includes('only essential') || combined.includes('essential only')) {
                        if (btn.offsetParent !== null) {
                            btn.click();
                            return true;
                        }
                    }
                }
                
                // Also look for cookie banners and try to close them
                const cookieBanners = document.querySelectorAll(
                    '[id*="cookie"], [class*="cookie"], [id*="gdpr"], [class*="gdpr"], [id*="consent"], [class*="consent"]'
                );
                
                cookieBanners.forEach(banner => {
                    const closeBtn = banner.querySelector('button, [role="button"], .close, [aria-label*="close"]');
                    if (closeBtn && closeBtn.offsetParent !== null) {
                        closeBtn.click();
                    }
                });
                
                return false;
            }
            
            // Run immediately
            denyCookies();
            
            // Watch for dynamically added cookie banners
            const observer = new MutationObserver(() => {
                setTimeout(denyCookies, 100);
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            
            // Also check periodically
            setInterval(denyCookies, 2000);
        })();
    "#;
    
    let _ = webview.eval(cookie_script);
}

fn inject_adblock_script(webview: &tauri::WebviewWindow, allow_ads: bool) {
    if allow_ads {
        return; // Don't inject if ads are allowed
    }
    
    let adblock_script = r#"
        (function() {
            const adSelectors = [
                '[class*="ad"]', '[id*="ad"]', '[class*="advertisement"]', '[id*="advertisement"]',
                '[class*="banner"]', 'iframe[src*="doubleclick"]', 'iframe[src*="googlesyndication"]',
                'iframe[src*="adservice"]', '[class*="sponsor"]', '[id*="sponsor"]'
            ];
            
            function blockAds() {
                adSelectors.forEach(selector => {
                    try {
                        const elements = document.querySelectorAll(selector);
                        elements.forEach(el => {
                            if (el.tagName === 'IFRAME') {
                                el.remove();
                            } else {
                                el.style.display = 'none';
                            }
                        });
                    } catch(e) {}
                });
            }
            
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', blockAds);
            } else {
                blockAds();
            }
            
            const observer = new MutationObserver(blockAds);
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        })();
    "#;
    
    let _ = webview.eval(adblock_script);
}

fn inject_popup_blocking_script(webview: &tauri::WebviewWindow, allow_popups: bool) {
    if allow_popups {
        return; // Don't inject if popups are allowed
    }
    
    let popup_script = r#"
        (function() {
            const originalOpen = window.open;
            window.open = function(...args) {
                const url = args[0];
                if (url && typeof url === 'string') {
                    if (url.includes('popup') || url.includes('popunder') ||
                        url.includes('advertisement') || url.includes('doubleclick') ||
                        url.includes('googlesyndication')) {
                        console.log('Blocked popup:', url);
                        return null;
                    }
                }
                return originalOpen.apply(window, args);
            };
            
            window.addEventListener('beforeunload', (e) => {
                e.preventDefault();
                e.returnValue = '';
            });
        })();
    "#;
    
    let _ = webview.eval(popup_script);
}

#[command]
pub async fn navigate_main_window(url: String, app: AppHandle) -> Result<(), String> {
    // Navigate the main window's webview directly
    // The React UI will be an overlay on top
    let main_window = app.get_webview_window("main")
        .or_else(|| app.get_webview_window(""))
        .ok_or_else(|| "Main window not found".to_string())?;
    
    let parsed_url = resolve_navigate_url(&app, &url)?;
    main_window.navigate(parsed_url)
        .map_err(|e| format!("Failed to navigate: {}", e))?;
    
    Ok(())
}

#[command]
pub async fn position_browser_window(_x: f64, _y: f64, _width: f64, _height: f64, _app: AppHandle) -> Result<(), String> {
    // No longer needed - we use the main window's webview directly
    // This function is kept for API compatibility but does nothing
    Ok(())
}

#[command]
pub async fn close_embedded_browser(_app: AppHandle) -> Result<(), String> {
    // No longer needed - we use the main window's webview directly
    // This function is kept for API compatibility but does nothing
    Ok(())
}

#[command]
pub async fn open_browser(url: String, tab_id: String, app: AppHandle) -> Result<BrowserTabInfo, String> {
    let window_label_opt = {
        let windows = BROWSER_WINDOWS.lock().unwrap();
        windows.get(&tab_id).cloned()
    };
    
    // Check if webview already exists for this tab
    if let Some(window_label) = window_label_opt {
        if let Some(window) = app.get_webview_window(&window_label) {
            // Navigate existing webview
            let parsed_url = Url::parse(&url).map_err(|e| format!("Invalid URL: {}", e))?;
            window.navigate(parsed_url)
                .map_err(|e| format!("Failed to navigate: {}", e))?;
            
            // Re-inject scripts after navigation (default: deny all)
            std::thread::sleep(std::time::Duration::from_millis(1000));
            inject_cookie_denial_script(&window, false);
            inject_adblock_script(&window, false);
            inject_popup_blocking_script(&window, false);
            
            return Ok(BrowserTabInfo {
                id: tab_id.clone(),
                url: url.clone(),
                title: "Loading...".to_string(),
                can_go_back: false,
                can_go_forward: false,
            });
        }
    }
    
    // Create new webview window
    let window_label = format!("browser_{}", tab_id);
    
    // Use WebviewUrl::External for external URLs to avoid X-Frame-Options issues
    let webview_url = if url.starts_with("http://") || url.starts_with("https://") {
        WebviewUrl::External(url.parse().map_err(|e| format!("Invalid URL: {}", e))?)
    } else {
        WebviewUrl::App(url.parse().map_err(|e| format!("Invalid URL: {}", e))?)
    };
    
    let webview = WebviewWindowBuilder::new(
        &app,
        &window_label,
        webview_url
    )
    .title("Browser")
    .inner_size(1280.0, 800.0)
    .center()
    .maximizable(true)
    .decorations(true)
    .transparent(false)
    .resizable(true)
    .build()
    .map_err(|e| format!("Failed to create webview: {}", e))?;
    
    // Store the mapping
    {
        let mut windows = BROWSER_WINDOWS.lock().unwrap();
        windows.insert(tab_id.clone(), window_label.clone());
    }
    
    // Inject scripts after page loads (default: deny all)
    let webview_clone = webview.clone();
    std::thread::spawn(move || {
        // Wait for page to load
        std::thread::sleep(std::time::Duration::from_millis(1500));
        
        inject_cookie_denial_script(&webview_clone, false);
        inject_adblock_script(&webview_clone, false);
        inject_popup_blocking_script(&webview_clone, false);
    });
    
    Ok(BrowserTabInfo {
        id: tab_id,
        url: url.clone(),
        title: "Loading...".to_string(),
        can_go_back: false,
        can_go_forward: false,
    })
}

#[command]
pub async fn close_browser_tab(tab_id: String, app: AppHandle) -> Result<(), String> {
    let window_label = {
        let mut windows = BROWSER_WINDOWS.lock().unwrap();
        windows.remove(&tab_id)
    };
    
    if let Some(window_label) = window_label {
        if let Some(window) = app.get_webview_window(&window_label) {
            window.close().map_err(|e| format!("Failed to close webview: {}", e))?;
        }
    }
    
    Ok(())
}

#[command]
pub async fn navigate_browser(tab_id: String, url: String, app: AppHandle) -> Result<(), String> {
    let window_label_opt = {
        let windows = BROWSER_WINDOWS.lock().unwrap();
        windows.get(&tab_id).cloned()
    };
    
    if let Some(window_label) = window_label_opt {
        if let Some(window) = app.get_webview_window(&window_label) {
            let parsed_url = Url::parse(&url).map_err(|e| format!("Invalid URL: {}", e))?;
            window.navigate(parsed_url)
                .map_err(|e| format!("Failed to navigate: {}", e))?;
            
            // Re-inject scripts after navigation (default: deny all)
            let window_clone = window.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(1500));
                inject_cookie_denial_script(&window_clone, false);
                inject_adblock_script(&window_clone, false);
                inject_popup_blocking_script(&window_clone, false);
            });
            
            return Ok(());
        }
    }
    
    Err(format!("Webview not found for tab: {}", tab_id))
}

#[command]
pub async fn go_back(tab_id: String, app: AppHandle) -> Result<(), String> {
    let window_label_opt = {
        let windows = BROWSER_WINDOWS.lock().unwrap();
        windows.get(&tab_id).cloned()
    };
    
    if let Some(window_label) = window_label_opt {
        if let Some(window) = app.get_webview_window(&window_label) {
            window.eval("window.history.back()")
                .map_err(|e| format!("Failed to go back: {}", e))?;
            return Ok(());
        }
    }
    
    Err(format!("Webview not found for tab: {}", tab_id))
}

#[command]
pub async fn go_forward(tab_id: String, app: AppHandle) -> Result<(), String> {
    // Use main window for embedded_browser
    if tab_id == "embedded_browser" {
        let main_window = app.get_webview_window("main")
            .or_else(|| app.get_webview_window(""))
            .ok_or_else(|| "Main window not found".to_string())?;
        main_window.eval("window.history.forward()")
            .map_err(|e| format!("Failed to go forward: {}", e))?;
        return Ok(());
    }
    
    // Support tab-based windows
    let window_label_opt = {
        let windows = BROWSER_WINDOWS.lock().unwrap();
        windows.get(&tab_id).cloned()
    };
    
    if let Some(window_label) = window_label_opt {
        if let Some(window) = app.get_webview_window(&window_label) {
            window.eval("window.history.forward()")
                .map_err(|e| format!("Failed to go forward: {}", e))?;
            return Ok(());
        }
    }
    
    Err(format!("Webview not found for tab: {}", tab_id))
}

#[command]
pub async fn reload_browser(tab_id: String, app: AppHandle) -> Result<(), String> {
    // Use main window for embedded_browser
    if tab_id == "embedded_browser" {
        let main_window = app.get_webview_window("main")
            .or_else(|| app.get_webview_window(""))
            .ok_or_else(|| "Main window not found".to_string())?;
        main_window.eval("window.location.reload()")
            .map_err(|e| format!("Failed to reload: {}", e))?;
        return Ok(());
    }
    
    // Support tab-based windows
    let window_label_opt = {
        let windows = BROWSER_WINDOWS.lock().unwrap();
        windows.get(&tab_id).cloned()
    };
    
    if let Some(window_label) = window_label_opt {
        if let Some(window) = app.get_webview_window(&window_label) {
            window.eval("window.location.reload()")
                .map_err(|e| format!("Failed to reload: {}", e))?;
            return Ok(());
        }
    }
    
    Err(format!("Webview not found for tab: {}", tab_id))
}

#[command]
pub async fn get_browser_info(tab_id: String, app: AppHandle) -> Result<BrowserTabInfo, String> {
    let window_label_opt = {
        let windows = BROWSER_WINDOWS.lock().unwrap();
        windows.get(&tab_id).cloned()
    };
    
    if let Some(window_label) = window_label_opt {
        if let Some(_window) = app.get_webview_window(&window_label) {
            return Ok(BrowserTabInfo {
                id: tab_id,
                url: "".to_string(),
                title: "".to_string(),
                can_go_back: false,
                can_go_forward: false,
            });
        }
    }
    
    Err(format!("Webview not found for tab: {}", tab_id))
}

#[command]
pub async fn inject_scripts_with_permissions(
    tab_id: String,
    allow_cookies: bool,
    allow_ads: bool,
    allow_popups: bool,
    app: AppHandle
) -> Result<(), String> {
    // Use main window for embedded_browser
    if tab_id == "embedded_browser" {
        let main_window = app.get_webview_window("main")
            .or_else(|| app.get_webview_window(""))
            .ok_or_else(|| "Main window not found".to_string())?;
        
        inject_cookie_denial_script(&main_window, allow_cookies);
        inject_adblock_script(&main_window, allow_ads);
        inject_popup_blocking_script(&main_window, allow_popups);
        
        // Inject a script to create a fixed titlebar at the top
        // This will be a simple overlay that stays visible
        let titlebar_script = r#"
            (function() {
                function createTitlebar() {
                    // Remove existing titlebar if any
                    const existing = document.getElementById('portal-browser-titlebar');
                    if (existing) existing.remove();
                    
                    // Wait for body to exist
                    if (!document.body) {
                        setTimeout(createTitlebar, 100);
                        return;
                    }
                    
                    // Create titlebar container
                    const titlebar = document.createElement('div');
                    titlebar.id = 'portal-browser-titlebar';
                    titlebar.style.cssText = `
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        height: 56px !important;
                        background: #1a1a1a !important;
                        border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
                        z-index: 2147483647 !important;
                        display: flex !important;
                        align-items: center !important;
                        padding: 0 16px !important;
                        gap: 8px !important;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
                        font-family: system-ui, -apple-system, sans-serif !important;
                    `;
                    
                    // Add back button
                    const backBtn = document.createElement('button');
                    backBtn.innerHTML = '←';
                    backBtn.style.cssText = 'width: 36px; height: 36px; border: none; background: transparent; color: #fff; cursor: pointer; border-radius: 4px; font-size: 18px; display: flex; align-items: center; justify-content: center;';
                    backBtn.onmouseover = () => backBtn.style.background = 'rgba(255, 255, 255, 0.1)';
                    backBtn.onmouseout = () => backBtn.style.background = 'transparent';
                    backBtn.onclick = () => window.history.back();
                    titlebar.appendChild(backBtn);
                    
                    // Add forward button
                    const forwardBtn = document.createElement('button');
                    forwardBtn.innerHTML = '→';
                    forwardBtn.style.cssText = 'width: 36px; height: 36px; border: none; background: transparent; color: #fff; cursor: pointer; border-radius: 4px; font-size: 18px; display: flex; align-items: center; justify-content: center;';
                    forwardBtn.onmouseover = () => forwardBtn.style.background = 'rgba(255, 255, 255, 0.1)';
                    forwardBtn.onmouseout = () => forwardBtn.style.background = 'transparent';
                    forwardBtn.onclick = () => window.history.forward();
                    titlebar.appendChild(forwardBtn);
                    
                    // Add reload button
                    const reloadBtn = document.createElement('button');
                    reloadBtn.innerHTML = '↻';
                    reloadBtn.style.cssText = 'width: 36px; height: 36px; border: none; background: transparent; color: #fff; cursor: pointer; border-radius: 4px; font-size: 18px; display: flex; align-items: center; justify-content: center;';
                    reloadBtn.onmouseover = () => reloadBtn.style.background = 'rgba(255, 255, 255, 0.1)';
                    reloadBtn.onmouseout = () => reloadBtn.style.background = 'transparent';
                    reloadBtn.onclick = () => window.location.reload();
                    titlebar.appendChild(reloadBtn);
                    
                    // Add URL display
                    const urlDisplay = document.createElement('div');
                    urlDisplay.textContent = window.location.href;
                    urlDisplay.style.cssText = 'flex: 1; color: #fff; font-size: 14px; padding: 0 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
                    titlebar.appendChild(urlDisplay);
                    
                    // Add site permissions toggle button
                    const permissionsBtn = document.createElement('button');
                    permissionsBtn.innerHTML = '⚙';
                    permissionsBtn.title = 'Site Permissions';
                    permissionsBtn.style.cssText = 'width: 36px; height: 36px; border: none; background: transparent; color: #fff; cursor: pointer; border-radius: 4px; font-size: 18px; display: flex; align-items: center; justify-content: center; position: relative;';
                    permissionsBtn.onmouseover = () => permissionsBtn.style.background = 'rgba(255, 255, 255, 0.1)';
                    permissionsBtn.onmouseout = () => {
                        if (!permissionsBtn.classList.contains('active')) {
                            permissionsBtn.style.background = 'transparent';
                        }
                    };
                    
                    // Create permissions panel
                    const permissionsPanel = document.createElement('div');
                    permissionsPanel.id = 'portal-permissions-panel';
                    permissionsPanel.style.cssText = `
                        position: fixed !important;
                        top: 56px !important;
                        right: 16px !important;
                        width: 300px !important;
                        background: #1a1a1a !important;
                        border: 1px solid rgba(255, 255, 255, 0.1) !important;
                        border-radius: 8px !important;
                        padding: 16px !important;
                        z-index: 2147483647 !important;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5) !important;
                        display: none !important;
                        font-family: system-ui, -apple-system, sans-serif !important;
                    `;
                    
                    // Get current domain
                    const domain = window.location.hostname.replace('www.', '');
                    
                    // Get permissions from localStorage
                    const getPermissions = () => {
                        try {
                            const stored = localStorage.getItem('sitePermissions_' + domain);
                            if (stored) {
                                return JSON.parse(stored);
                            }
                        } catch(e) {}
                        return { allowCookies: false, allowAds: false, allowPopups: false };
                    };
                    
                    // Save permissions to localStorage
                    const savePermissions = (perms) => {
                        try {
                            localStorage.setItem('sitePermissions_' + domain, JSON.stringify(perms));
                        } catch(e) {}
                    };
                    
                    // Create permissions UI
                    const createPermissionsUI = () => {
                        const perms = getPermissions();
                        
                        permissionsPanel.innerHTML = `
                            <div style="margin-bottom: 12px; color: #fff; font-weight: 600; font-size: 16px;">Site Permissions</div>
                            <div style="margin-bottom: 8px; color: rgba(255, 255, 255, 0.6); font-size: 12px;">${domain}</div>
                            <div style="margin-top: 16px; display: flex; flex-direction: column; gap: 12px;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div style="display: flex; align-items: center; gap: 8px; color: #fff; font-size: 14px;">
                                        <span>🍪</span>
                                        <span>Allow Cookies</span>
                                    </div>
                                    <button id="perm-cookies" style="width: 60px; height: 28px; border: 1px solid rgba(255, 255, 255, 0.2); background: ${perms.allowCookies ? '#007bff' : 'transparent'}; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                        ${perms.allowCookies ? 'Allow' : 'Deny'}
                                    </button>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div style="display: flex; align-items: center; gap: 8px; color: #fff; font-size: 14px;">
                                        <span>🚫</span>
                                        <span>Allow Ads</span>
                                    </div>
                                    <button id="perm-ads" style="width: 60px; height: 28px; border: 1px solid rgba(255, 255, 255, 0.2); background: ${perms.allowAds ? '#007bff' : 'transparent'}; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                        ${perms.allowAds ? 'Allow' : 'Block'}
                                    </button>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div style="display: flex; align-items: center; gap: 8px; color: #fff; font-size: 14px;">
                                        <span>📦</span>
                                        <span>Allow Popups</span>
                                    </div>
                                    <button id="perm-popups" style="width: 60px; height: 28px; border: 1px solid rgba(255, 255, 255, 0.2); background: ${perms.allowPopups ? '#007bff' : 'transparent'}; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                        ${perms.allowPopups ? 'Allow' : 'Block'}
                                    </button>
                                </div>
                            </div>
                        `;
                        
                        // Add event listeners to toggle buttons
                        const cookiesBtn = permissionsPanel.querySelector('#perm-cookies');
                        const adsBtn = permissionsPanel.querySelector('#perm-ads');
                        const popupsBtn = permissionsPanel.querySelector('#perm-popups');
                        
                        cookiesBtn.onclick = () => {
                            perms.allowCookies = !perms.allowCookies;
                            savePermissions(perms);
                            createPermissionsUI();
                            // Reload to apply changes
                            setTimeout(() => window.location.reload(), 500);
                        };
                        
                        adsBtn.onclick = () => {
                            perms.allowAds = !perms.allowAds;
                            savePermissions(perms);
                            createPermissionsUI();
                            // Reload to apply changes
                            setTimeout(() => window.location.reload(), 500);
                        };
                        
                        popupsBtn.onclick = () => {
                            perms.allowPopups = !perms.allowPopups;
                            savePermissions(perms);
                            createPermissionsUI();
                            // Reload to apply changes
                            setTimeout(() => window.location.reload(), 500);
                        };
                    };
                    
                    createPermissionsUI();
                    document.body.appendChild(permissionsPanel);
                    
                    // Toggle permissions panel
                    permissionsBtn.onclick = (e) => {
                        e.stopPropagation();
                        const isVisible = permissionsPanel.style.display !== 'none';
                        permissionsPanel.style.display = isVisible ? 'none' : 'block';
                        if (!isVisible) {
                            permissionsBtn.classList.add('active');
                            permissionsBtn.style.background = 'rgba(255, 255, 255, 0.15)';
                        } else {
                            permissionsBtn.classList.remove('active');
                            permissionsBtn.style.background = 'transparent';
                        }
                    };
                    
                    // Close panel when clicking outside
                    document.addEventListener('click', (e) => {
                        if (!permissionsPanel.contains(e.target) && e.target !== permissionsBtn) {
                            permissionsPanel.style.display = 'none';
                            permissionsBtn.classList.remove('active');
                            permissionsBtn.style.background = 'transparent';
                        }
                    });
                    
                    titlebar.appendChild(permissionsBtn);
                    
                    // Add close button
                    const closeBtn = document.createElement('button');
                    closeBtn.innerHTML = '✕';
                    closeBtn.style.cssText = 'width: 36px; height: 36px; border: none; background: transparent; color: #fff; cursor: pointer; border-radius: 4px; font-size: 18px; display: flex; align-items: center; justify-content: center;';
                    closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(255, 0, 0, 0.2)';
                    closeBtn.onmouseout = () => closeBtn.style.background = 'transparent';
                    closeBtn.onclick = () => {
                        // Navigate back to app
                        window.location.href = 'index.html';
                    };
                    titlebar.appendChild(closeBtn);
                    
                    // Insert at the very beginning of body
                    document.body.insertBefore(titlebar, document.body.firstChild);
                    
                    // Adjust body padding to account for titlebar
                    const originalPadding = document.body.style.paddingTop;
                    document.body.style.paddingTop = '56px';
                    
                    // Function to check fullscreen state and hide/show titlebar
                    const checkFullscreen = () => {
                        const isFullscreen = document.fullscreenElement || 
                                            document.webkitFullscreenElement || 
                                            document.mozFullScreenElement || 
                                            document.msFullscreenElement;
                        
                        if (isFullscreen) {
                            titlebar.style.display = 'none';
                            // Remove padding when fullscreen
                            document.body.style.paddingTop = originalPadding || '0';
                        } else {
                            titlebar.style.display = 'flex';
                            // Restore padding when not fullscreen
                            document.body.style.paddingTop = '56px';
                        }
                    };
                    
                    // Listen for fullscreen changes
                    document.addEventListener('fullscreenchange', checkFullscreen);
                    document.addEventListener('webkitfullscreenchange', checkFullscreen);
                    document.addEventListener('mozfullscreenchange', checkFullscreen);
                    document.addEventListener('MSFullscreenChange', checkFullscreen);
                    
                    // Also check periodically in case events don't fire
                    setInterval(checkFullscreen, 500);
                    
                    // Initial check
                    checkFullscreen();
                    
                    // Update URL display on navigation
                    const updateUrl = () => {
                        if (urlDisplay) {
                            urlDisplay.textContent = window.location.href;
                        }
                    };
                    window.addEventListener('popstate', updateUrl);
                    
                    // Re-inject if removed (some sites might try to remove it)
                    const observer = new MutationObserver(() => {
                        if (!document.getElementById('portal-browser-titlebar')) {
                            createTitlebar();
                        }
                    });
                    observer.observe(document.body, { childList: true, subtree: true });
                }
                
                // Try to create immediately
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', createTitlebar);
                } else {
                    createTitlebar();
                }
                
                // Also try after a delay to ensure it's created
                setTimeout(createTitlebar, 500);
                setTimeout(createTitlebar, 1000);
                setTimeout(createTitlebar, 2000);
            })();
        "#;
        
        // Inject immediately and also after a delay
        let _ = main_window.eval(titlebar_script);
        
        // Also inject after a longer delay to ensure it persists
        let titlebar_script_clone = titlebar_script.to_string();
        let app_clone = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(2000));
            if let Some(window) = app_clone.get_webview_window("main").or_else(|| app_clone.get_webview_window("")) {
                let _ = window.eval(&titlebar_script_clone);
            }
        });
        
        return Ok(());
    }
    
    // Support tab-based windows
    let window_label_opt = {
        let windows = BROWSER_WINDOWS.lock().unwrap();
        windows.get(&tab_id).cloned()
    };
    
    if let Some(window_label) = window_label_opt {
        if let Some(window) = app.get_webview_window(&window_label) {
            inject_cookie_denial_script(&window, allow_cookies);
            inject_adblock_script(&window, allow_ads);
            inject_popup_blocking_script(&window, allow_popups);
            return Ok(());
        }
    }
    
    Err(format!("Webview not found for tab: {}", tab_id))
}
