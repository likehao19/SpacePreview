use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{menu::MenuItem, tray::TrayIconBuilder, App, AppHandle, Manager, State};

const TRAY_ID: &str = "main-tray";

pub struct TrayPreference {
    path: PathBuf,
    visible: Mutex<bool>,
}

fn load(path: &Path) -> bool {
    fs::read(path)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or(true)
}

fn save(path: &Path, visible: bool) -> std::io::Result<()> {
    fs::create_dir_all(path.parent().unwrap())?;
    let temporary = path.with_extension("tmp");
    let result = fs::write(&temporary, if visible { "true" } else { "false" })
        .and_then(|_| fs::rename(&temporary, path));
    if result.is_err() {
        let _ = fs::remove_file(temporary);
    }
    result
}

fn create(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "打开瞬览", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出瞬览", true, None::<&str>)?;
    #[cfg(not(target_os = "macos"))]
    let menu = tauri::menu::Menu::with_items(app, &[&show, &quit])?;
    #[cfg(target_os = "macos")]
    let menu = crate::macos_menu::tray_menu(app, &show, &quit)?;
    let mut tray = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .tooltip("瞬览 SpacePreview");
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    #[cfg(target_os = "macos")]
    {
        tray = tray
            .icon(crate::macos_menu::tray_icon())
            .icon_as_template(true)
            .show_menu_on_left_click(true);
    }
    tray.on_menu_event(|app, event| match event.id.as_ref() {
        "show" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }
        "quit" => app.exit(0),
        _ => (),
    })
    .build(app)?;
    Ok(())
}

pub fn configure(app: &App) -> tauri::Result<()> {
    let path = app.path().app_config_dir()?.join("tray-visible.json");
    let visible = load(&path);
    // Hidden at startup means no status item is created, avoiding an icon flash.
    if visible {
        create(app.handle())?;
    }
    app.manage(TrayPreference {
        path,
        visible: Mutex::new(visible),
    });
    Ok(())
}

#[tauri::command]
pub fn tray_visible(preference: State<'_, TrayPreference>) -> Result<bool, String> {
    preference
        .visible
        .lock()
        .map(|value| *value)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_tray_visible(
    app: AppHandle,
    preference: State<'_, TrayPreference>,
    visible: bool,
) -> Result<bool, String> {
    let mut current = preference
        .visible
        .lock()
        .map_err(|error| error.to_string())?;
    if *current == visible {
        return Ok(visible);
    }
    if visible && app.tray_by_id(TRAY_ID).is_none() {
        create(&app).map_err(|error| error.to_string())?;
    }
    let tray = app.tray_by_id(TRAY_ID).ok_or("找不到瞬览托盘图标")?;
    tray.set_visible(visible)
        .map_err(|error| error.to_string())?;
    if let Err(error) = save(&preference.path, visible) {
        let _ = tray.set_visible(*current);
        return Err(error.to_string());
    }
    *current = visible;
    Ok(visible)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_to_visible_and_restores_both_saved_choices() {
        let root = std::env::temp_dir().join(format!("spacepreview-tray-{}", std::process::id()));
        let path = root.join("config/tray-visible.json");
        assert!(load(&path));
        save(&path, false).unwrap();
        assert!(!load(&path));
        save(&path, true).unwrap();
        assert!(load(&path));
        fs::write(&path, b"broken setting").unwrap();
        assert!(load(&path));
        assert!(!path.with_extension("tmp").exists());
        fs::remove_dir_all(root).unwrap();
    }
}
