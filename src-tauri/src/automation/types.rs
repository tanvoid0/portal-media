use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayInfo {
    pub index: u32,
    pub name: String,
    pub primary: bool,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDeviceInfo {
    pub id: String,
    pub name: String,
    pub default_multimedia: bool,
    pub default_communications: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AutomationAction {
    DisableDisplays { indexes: Vec<u32> },
    RestoreDisplays,
    SetDefaultAudioDevice {
        #[serde(rename = "deviceId")]
        device_id: String,
    },
    RestoreAudioDevice,
    LaunchProcess { path: String, #[serde(default)] args: Vec<String> },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationProfile {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub on_launch: Vec<AutomationAction>,
    #[serde(default)]
    pub on_exit: Vec<AutomationAction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationConfig {
    pub enabled: bool,
    #[serde(default)]
    pub default_profile_id: Option<String>,
    #[serde(default)]
    pub game_assignments: std::collections::HashMap<String, String>,
    #[serde(default)]
    pub profiles: Vec<AutomationProfile>,
}

impl Default for AutomationConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            default_profile_id: Some("default".to_string()),
            game_assignments: std::collections::HashMap::new(),
            profiles: vec![AutomationProfile {
                id: "default".to_string(),
                name: "Gaming".to_string(),
                on_launch: vec![],
                on_exit: vec![AutomationAction::RestoreDisplays, AutomationAction::RestoreAudioDevice],
            }],
        }
    }
}
