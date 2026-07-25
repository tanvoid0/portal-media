//! Native XInput polling — works while a game or the embedded browser owns
//! focus, where the webview Gamepad API is silent.
//!
//! Two features share one 8 ms poll thread:
//! - **Focus chord**: Back+Start pressed together focuses the Portal window
//!   (the "Guide button moment"; the real Guide button is reserved by Windows
//!   Game Bar and hidden from the public XInput API).
//! - **Virtual cursor**: while the embedded browser is open, the right stick
//!   moves the OS pointer (SendInput), A = left click, B = right click,
//!   left stick = wheel scroll — Steam Big Picture style.
//!
//! ponytail: XInput only — DualSense over USB/BT without Steam Input is not
//! seen here; swap to `gilrs` if that matters later.

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::AppHandle;

static CURSOR_PREF: AtomicBool = AtomicBool::new(true);
static FOCUS_CHORD_PREF: AtomicBool = AtomicBool::new(true);
/// Browser webview open and not minimized (pushed from the frontend).
static BROWSER_ACTIVE: AtomicBool = AtomicBool::new(false);

/// Persisted prefs pushed from the frontend at boot and on settings change.
#[tauri::command]
pub fn native_gamepad_set_prefs(cursor_enabled: bool, focus_chord_enabled: bool) {
    CURSOR_PREF.store(cursor_enabled, Ordering::SeqCst);
    FOCUS_CHORD_PREF.store(focus_chord_enabled, Ordering::SeqCst);
}

#[tauri::command]
pub fn native_cursor_set_browser_active(active: bool) {
    BROWSER_ACTIVE.store(active, Ordering::SeqCst);
}

pub fn setup(app: &tauri::App) -> Result<(), String> {
    #[cfg(windows)]
    {
        let handle = app.handle().clone();
        std::thread::spawn(move || poll_loop(handle));
    }
    let _ = app;
    Ok(())
}

#[cfg(windows)]
fn poll_loop(app: AppHandle) {
    use std::time::{Duration, Instant};
    use windows::Win32::UI::Input::XboxController::{
        XInputGetState, XINPUT_GAMEPAD_A, XINPUT_GAMEPAD_B, XINPUT_GAMEPAD_BACK,
        XINPUT_GAMEPAD_START, XINPUT_STATE,
    };

    const POLL_MS: u64 = 8;
    /// Rescan for a controller this often while none is connected — polling
    /// empty XInput slots every frame is expensive.
    const RESCAN_MS: u128 = 2000;
    const STICK_DEADZONE: f32 = 0.28;
    const CURSOR_MAX_PX_PER_S: f32 = 1500.0;
    const WHEEL_UNITS_PER_S: f32 = 5.0; // ×120 wheel delta

    let mut connected: Option<u32> = None;
    let mut last_rescan = Instant::now() - Duration::from_secs(10);
    let mut last_tick = Instant::now();

    let mut chord_was_down = false;
    let mut a_was_down = false;
    let mut b_was_down = false;
    let mut move_rem = (0.0f32, 0.0f32);
    let mut wheel_rem = 0.0f32;

    loop {
        std::thread::sleep(Duration::from_millis(POLL_MS));
        let now = Instant::now();
        let dt = (now - last_tick).as_secs_f32().min(0.1);
        last_tick = now;

        let mut state = XINPUT_STATE::default();
        let idx = match connected {
            Some(i) => Some(i),
            None => {
                if last_rescan.elapsed().as_millis() < RESCAN_MS {
                    continue;
                }
                last_rescan = now;
                (0..4u32).find(|i| unsafe { XInputGetState(*i, &mut state) } == 0)
            }
        };
        let Some(i) = idx else { continue };
        if unsafe { XInputGetState(i, &mut state) } != 0 {
            connected = None;
            continue;
        }
        connected = Some(i);

        let pad = &state.Gamepad;
        let buttons = pad.wButtons;

        // ---- focus chord: Back + Start ----
        let chord_down = buttons.contains(XINPUT_GAMEPAD_BACK) && buttons.contains(XINPUT_GAMEPAD_START);
        if chord_down && !chord_was_down && FOCUS_CHORD_PREF.load(Ordering::SeqCst) {
            let _ = crate::focus_watchdog::focus_portal_main_window(app.clone());
            use tauri::Emitter;
            let _ = app.emit("native-focus-chord", ());
        }
        chord_was_down = chord_down;

        // ---- virtual cursor (browser open + pref on) ----
        if !(CURSOR_PREF.load(Ordering::SeqCst) && BROWSER_ACTIVE.load(Ordering::SeqCst)) {
            // Release any held buttons so we never leave a stuck mouse button.
            if a_was_down {
                send_mouse_button(false, true);
                a_was_down = false;
            }
            if b_was_down {
                send_mouse_button(false, false);
                b_was_down = false;
            }
            continue;
        }

        // Right stick → pointer, cubic response for fine control.
        let (nx, ny) = (norm_stick(pad.sThumbRX, STICK_DEADZONE), norm_stick(pad.sThumbRY, STICK_DEADZONE));
        if nx != 0.0 || ny != 0.0 {
            let dx = nx.powi(3).mul_add(CURSOR_MAX_PX_PER_S * dt, move_rem.0);
            let dy = (-ny).powi(3).mul_add(CURSOR_MAX_PX_PER_S * dt, move_rem.1);
            let (ix, iy) = (dx.trunc(), dy.trunc());
            move_rem = (dx - ix, dy - iy);
            if ix != 0.0 || iy != 0.0 {
                send_mouse_move(ix as i32, iy as i32);
            }
        } else {
            move_rem = (0.0, 0.0);
        }

        // Left stick Y → wheel scroll.
        let sy = norm_stick(pad.sThumbLY, STICK_DEADZONE);
        if sy != 0.0 {
            let w = sy.powi(3).mul_add(WHEEL_UNITS_PER_S * 120.0 * dt, wheel_rem);
            let iw = w.trunc();
            wheel_rem = w - iw;
            if iw != 0.0 {
                send_mouse_wheel(iw as i32);
            }
        } else {
            wheel_rem = 0.0;
        }

        // A / B → left / right click (press-and-hold supported for drag).
        let a_down = buttons.contains(XINPUT_GAMEPAD_A);
        if a_down != a_was_down {
            send_mouse_button(a_down, true);
            a_was_down = a_down;
        }
        let b_down = buttons.contains(XINPUT_GAMEPAD_B);
        if b_down != b_was_down {
            send_mouse_button(b_down, false);
            b_was_down = b_down;
        }
    }
}

#[cfg(windows)]
fn norm_stick(raw: i16, deadzone: f32) -> f32 {
    let v = f32::from(raw) / 32767.0;
    if v.abs() < deadzone {
        return 0.0;
    }
    // Rescale so movement ramps from 0 at the deadzone edge.
    let sign = v.signum();
    sign * ((v.abs() - deadzone) / (1.0 - deadzone)).min(1.0)
}

#[cfg(windows)]
fn send_mouse_input(flags: windows::Win32::UI::Input::KeyboardAndMouse::MOUSE_EVENT_FLAGS, dx: i32, dy: i32, data: i32) {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_MOUSE, MOUSEINPUT,
    };
    let input = INPUT {
        r#type: INPUT_MOUSE,
        Anonymous: INPUT_0 {
            mi: MOUSEINPUT {
                dx,
                dy,
                mouseData: data as u32,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    unsafe {
        SendInput(&[input], std::mem::size_of::<INPUT>() as i32);
    }
}

#[cfg(windows)]
fn send_mouse_move(dx: i32, dy: i32) {
    use windows::Win32::UI::Input::KeyboardAndMouse::MOUSEEVENTF_MOVE;
    send_mouse_input(MOUSEEVENTF_MOVE, dx, dy, 0);
}

#[cfg(windows)]
fn send_mouse_wheel(delta: i32) {
    use windows::Win32::UI::Input::KeyboardAndMouse::MOUSEEVENTF_WHEEL;
    send_mouse_input(MOUSEEVENTF_WHEEL, 0, 0, delta);
}

#[cfg(windows)]
fn send_mouse_button(down: bool, left: bool) {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP, MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP,
    };
    let flags = match (left, down) {
        (true, true) => MOUSEEVENTF_LEFTDOWN,
        (true, false) => MOUSEEVENTF_LEFTUP,
        (false, true) => MOUSEEVENTF_RIGHTDOWN,
        (false, false) => MOUSEEVENTF_RIGHTUP,
    };
    send_mouse_input(flags, 0, 0, 0);
}
