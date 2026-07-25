//! Windows Core Audio default device enumeration and PolicyConfig restore/set.

use super::types::AudioDeviceInfo;
use std::sync::Mutex;
use std::sync::OnceLock;

#[cfg(windows)]
use windows::core::{GUID, PCWSTR};
#[cfg(windows)]
use windows::Win32::Media::Audio::{
    eRender, DEVICE_STATE_ACTIVE, ERole, IMMDevice, IMMDeviceCollection, IMMDeviceEnumerator,
    MMDeviceEnumerator,
};
#[cfg(windows)]
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED,
};

#[cfg(windows)]
static AUDIO_SNAPSHOT: OnceLock<Mutex<Option<AudioSnapshot>>> = OnceLock::new();

#[cfg(windows)]
struct AudioSnapshot {
    multimedia: Option<String>,
    communications: Option<String>,
}

#[cfg(windows)]
fn snapshot_slot() -> &'static Mutex<Option<AudioSnapshot>> {
    AUDIO_SNAPSHOT.get_or_init(|| Mutex::new(None))
}

#[cfg(windows)]
#[windows_core::interface("F8679F50-850A-41CF-9C7C-11E39726922E")]
unsafe trait IPolicyConfig: windows_core::IUnknown {
    unsafe fn unused1(&self);
    unsafe fn unused2(&self);
    unsafe fn unused3(&self);
    unsafe fn unused4(&self);
    unsafe fn unused5(&self);
    unsafe fn unused6(&self);
    unsafe fn unused7(&self);
    unsafe fn unused8(&self);
    unsafe fn unused9(&self);
    unsafe fn unused10(&self);
    unsafe fn SetDefaultEndpoint(&self, device_id: PCWSTR, role: ERole) -> windows::core::HRESULT;
}

#[cfg(windows)]
const CLSID_POLICY_CONFIG: GUID = GUID::from_u128(0x870af69c_0d43_4f99_986c_74dab0e5f075);

pub fn list_audio_devices() -> Result<Vec<AudioDeviceInfo>, String> {
    #[cfg(windows)]
    {
        com_scope(|| list_audio_devices_inner())
    }
    #[cfg(not(windows))]
    {
        Err("Audio automation is only supported on Windows.".into())
    }
}

pub fn set_default_audio_device(device_id: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        save_audio_snapshot()?;
        com_scope(|| set_default_endpoint(device_id, ERole(1)))
    }
    #[cfg(not(windows))]
    {
        let _ = device_id;
        Err("Audio automation is only supported on Windows.".into())
    }
}

pub fn restore_audio_device() -> Result<(), String> {
    #[cfg(windows)]
    {
        let snap = snapshot_slot()
            .lock()
            .map_err(|e| format!("Audio snapshot lock poisoned: {e}"))?
            .take();
        let Some(snap) = snap else {
            return Ok(());
        };
        com_scope(|| {
            if let Some(id) = snap.multimedia {
                set_default_endpoint(&id, ERole(1))?;
            }
            if let Some(id) = snap.communications {
                set_default_endpoint(&id, ERole(2))?;
            }
            Ok(())
        })
    }
    #[cfg(not(windows))]
    {
        Ok(())
    }
}

#[cfg(windows)]
fn save_audio_snapshot() -> Result<(), String> {
    com_scope(|| {
        let multimedia = default_device_id(ERole(1))?;
        let communications = default_device_id(ERole(2))?;
        let mut slot = snapshot_slot()
            .lock()
            .map_err(|e| format!("Audio snapshot lock poisoned: {e}"))?;
        *slot = Some(AudioSnapshot {
            multimedia,
            communications,
        });
        Ok(())
    })
}

#[cfg(windows)]
fn com_scope<T>(f: impl FnOnce() -> Result<T, String>) -> Result<T, String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
    }
    let result = f();
    unsafe {
        CoUninitialize();
    }
    result
}

#[cfg(windows)]
fn list_audio_devices_inner() -> Result<Vec<AudioDeviceInfo>, String> {
    let enumerator: IMMDeviceEnumerator =
        unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) }
            .map_err(|e| format!("IMMDeviceEnumerator: {e}"))?;

    let collection: IMMDeviceCollection = unsafe {
        enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)
    }
    .map_err(|e| format!("EnumAudioEndpoints: {e}"))?;

    let count = unsafe { collection.GetCount() }.map_err(|e| format!("GetCount: {e}"))?;
    let default_mm = default_device_id(ERole(1))?;
    let default_comm = default_device_id(ERole(2))?;

    let mut out = Vec::new();
    for i in 0..count {
        let device: IMMDevice = unsafe { collection.Item(i) }.map_err(|e| format!("Item: {e}"))?;
        let id = device_id_string(&device)?;
        let name = device_label(&id);
        out.push(AudioDeviceInfo {
            id: id.clone(),
            name,
            default_multimedia: default_mm.as_deref() == Some(id.as_str()),
            default_communications: default_comm.as_deref() == Some(id.as_str()),
        });
    }
    Ok(out)
}

#[cfg(windows)]
fn default_device_id(role: ERole) -> Result<Option<String>, String> {
    let enumerator: IMMDeviceEnumerator =
        unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) }
            .map_err(|e| format!("IMMDeviceEnumerator: {e}"))?;
    let device = unsafe { enumerator.GetDefaultAudioEndpoint(eRender, role) }
        .map_err(|e| format!("GetDefaultAudioEndpoint: {e}"))?;
    Ok(Some(device_id_string(&device)?))
}

#[cfg(windows)]
fn device_id_string(device: &IMMDevice) -> Result<String, String> {
    let id = unsafe { device.GetId() }.map_err(|e| format!("GetId: {e}"))?;
    unsafe { id.to_string() }.map_err(|e| format!("device id: {e}"))
}

#[cfg(windows)]
fn device_label(id: &str) -> String {
    if let Some(end) = id.rsplit('#').next() {
        return end.to_string();
    }
    id.to_string()
}

#[cfg(windows)]
fn set_default_endpoint(device_id: &str, role: ERole) -> Result<(), String> {
    let policy: IPolicyConfig =
        unsafe { CoCreateInstance(&CLSID_POLICY_CONFIG, None, CLSCTX_ALL) }
            .map_err(|e| format!("PolicyConfig: {e}"))?;
    let wide: Vec<u16> = device_id.encode_utf16().chain(std::iter::once(0)).collect();
    let hr = unsafe { policy.SetDefaultEndpoint(PCWSTR(wide.as_ptr()), role) };
    if hr.is_err() {
        return Err(format!("SetDefaultEndpoint failed: {:?}", hr));
    }
    Ok(())
}
