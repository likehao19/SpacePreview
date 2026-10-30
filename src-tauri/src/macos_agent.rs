//! File manager integration stays in-process so macOS attributes permissions to this app.
use std::{
    cell::Cell,
    ffi::{c_char, CStr},
    path::Path,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        OnceLock,
    },
};
use tauri::{AppHandle, Manager};

use crate::macos_gesture::{candidate, SpaceGesture};

extern "C" {
    fn sp_mac_start(callback: extern "C" fn(u32, u64, i32, bool) -> bool);
    fn sp_mac_set_shortcut(key: u32, flags: u64);
    fn sp_mac_status() -> u32;
    fn sp_mac_last_key_result() -> u32;
    fn sp_mac_request_permissions(qspace: bool);
    fn sp_mac_frontmost_pid() -> i32;
    fn sp_mac_copy_selection(pid: i32) -> *mut c_char;
    fn sp_mac_free_string(value: *mut c_char);
    fn sp_mac_activate_manager(pid: i32);
    fn sp_mac_capture_navigation(pid: i32);
    fn sp_mac_navigation_valid(pid: i32) -> bool;
    fn sp_mac_navigate(pid: i32, direction: i32) -> bool;
}

static ENABLED: AtomicBool = AtomicBool::new(true);
static SOURCE_PID: std::sync::atomic::AtomicI32 = std::sync::atomic::AtomicI32::new(0);
static SOURCE_CONTEXT: std::sync::Mutex<String> = std::sync::Mutex::new(String::new());
static NAV_GENERATION: AtomicU64 = AtomicU64::new(0);
static GENERATION: AtomicU64 = AtomicU64::new(0);
static APP: OnceLock<AppHandle> = OnceLock::new();
thread_local! { static SPACE: Cell<SpaceGesture> = Cell::new(SpaceGesture::default()); }

extern "C" fn keyboard_event(kind: u32, flags: u64, pid: i32, repeat: bool) -> bool {
    let mut gesture = SPACE.get();
    let suppress = match kind {
        10 => gesture.keydown(
            if crate::shortcut::matches(
                crate::shortcut::current(),
                flags & (1 << 18) != 0,
                flags & (1 << 19) != 0,
                flags & (1 << 20) != 0,
            ) {
                candidate(
                    pid,
                    flags & !((1 << 18) | (1 << 19) | (1 << 20)),
                    ENABLED.load(Ordering::Relaxed),
                )
            } else {
                None
            },
            repeat,
        ),
        11 => {
            let pending = gesture.keyup();
            // Reset BEFORE the worker can cause focus to change.
            SPACE.set(gesture);
            if let Some((pid, text)) = pending {
                if ENABLED.load(Ordering::Relaxed) {
                    queue_preview(pid, text);
                }
                return true;
            }
            return false;
        }
        _ => {
            SPACE.set(SpaceGesture::default());
            return false;
        }
    };
    SPACE.set(gesture);
    suppress
}

pub fn set_enabled(enabled: bool) {
    if ENABLED.swap(enabled, Ordering::Relaxed) != enabled {
        GENERATION.fetch_add(1, Ordering::Relaxed);
    }
}

pub fn set_shortcut(config: u32) {
    let mods = config >> 16;
    let flags = (((mods & 1) as u64) << 18)
        | ((((mods >> 1) & 1) as u64) << 19)
        | ((((mods >> 2) & 1) as u64) << 20);
    GENERATION.fetch_add(1, Ordering::Relaxed);
    unsafe { sp_mac_set_shortcut((config >> 8) & 255, flags) };
}

pub fn status() -> serde_json::Value {
    let native = unsafe { sp_mac_status() };
    serde_json::json!({
        "supported": true, "platform": "macos",
        "enabled": ENABLED.load(Ordering::Relaxed),
        "running": native & 7 == 7,
        "accessibility": native & 1 != 0,
        "automation": native & 4 != 0,
        "qspaceInstalled": native & 16 != 0,
        "qspaceAutomation": native & 8 != 0,
        "qspaceRunning": native & 11 == 11,
        "keyboard": native & 2 != 0,
        "lastKeyResult": unsafe { sp_mac_last_key_result() },
    })
}

pub fn request_permissions(app: AppHandle, qspace: bool) -> tauri::Result<()> {
    app.run_on_main_thread(move || unsafe { sp_mac_request_permissions(qspace) })
}

pub fn hide_preview(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    cancel_navigation();
    let focused = window.is_focused().unwrap_or(false);
    window.hide()?;
    let pid = SOURCE_PID.swap(0, Ordering::Relaxed);
    // A blur close must not steal focus back from the user's chosen app.
    if focused && pid != 0 {
        window.app_handle().run_on_main_thread(move || unsafe {
            if sp_mac_frontmost_pid() == std::process::id() as i32 {
                sp_mac_activate_manager(pid);
            }
        })?;
    }
    Ok(())
}

fn selection(pid: i32) -> Result<(Vec<String>, String), String> {
    let pointer = unsafe { sp_mac_copy_selection(pid) };
    if pointer.is_null() {
        return Err("文件管理器选择读取失败。".into());
    }
    let json = unsafe { CStr::from_ptr(pointer) }
        .to_string_lossy()
        .into_owned();
    unsafe { sp_mac_free_string(pointer) };
    let result: serde_json::Value = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    if let Some(error) = result.get("error").and_then(|value| value.as_str()) {
        return Err(error.into());
    }
    let paths: Vec<String> =
        serde_json::from_value(result["paths"].clone()).map_err(|e| e.to_string())?;
    let context = result["context"].as_str().unwrap_or_default().to_owned();
    Ok((
        paths
            .into_iter()
            .filter(|path| Path::new(path).is_file() || Path::new(path).is_dir())
            .take(100)
            .collect(),
        context,
    ))
}

fn queue_preview(pid: i32, text: bool) {
    let Some(app) = APP.get() else {
        return;
    };
    let generation = GENERATION.fetch_add(1, Ordering::Relaxed) + 1;
    let app_for_ui = app.clone();
    // The tap thread only schedules work; NSAppleScript runs on the main thread.
    let _ = app.run_on_main_thread(move || {
        let current = || {
            ENABLED.load(Ordering::Relaxed)
                && GENERATION.load(Ordering::Relaxed) == generation
                && unsafe { sp_mac_frontmost_pid() == pid }
        };
        if !current() {
            return;
        }
        let result = selection(pid);
        if !current() {
            return;
        }
        match result {
            Ok((paths, context)) if !paths.is_empty() => {
                cancel_navigation();
                unsafe { sp_mac_capture_navigation(pid) };
                *SOURCE_CONTEXT.lock().unwrap() = context;
                SOURCE_PID.store(pid, Ordering::Relaxed);
                crate::show_preview_files(&app_for_ui, paths, text, true);
            }
            Ok(_) => {} // No selection is a normal no-op, not a request for the home window.
            Err(message) => {
                crate::diagnostics::record(format!("selection unavailable: {message}"));
            }
        }
    });
}

pub fn start(app: AppHandle) {
    if APP.set(app).is_err() {
        return;
    }
    unsafe { sp_mac_start(keyboard_event) };
}

pub fn cancel_navigation() {
    NAV_GENERATION.fetch_add(1, Ordering::SeqCst);
}

// AppleScript and AX queries run on the UI thread; waiting never does.
fn on_main<T: Send + 'static>(
    app: &AppHandle,
    f: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    let (send, receive) = std::sync::mpsc::sync_channel(1);
    app.run_on_main_thread(move || {
        let _ = send.send(f());
    })
    .map_err(|e| e.to_string())?;
    receive.recv().map_err(|e| e.to_string())?
}

pub async fn navigate(
    app: AppHandle,
    path: std::path::PathBuf,
    direction: i32,
) -> Result<Option<String>, String> {
    let generation = NAV_GENERATION.load(Ordering::SeqCst);
    let pid = SOURCE_PID.load(Ordering::Relaxed);
    let context = SOURCE_CONTEXT.lock().map_err(|e| e.to_string())?.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let valid = move || {
            pid != 0
                && SOURCE_PID.load(Ordering::Relaxed) == pid
                && NAV_GENERATION.load(Ordering::SeqCst) == generation
                && unsafe {
                    sp_mac_frontmost_pid() == std::process::id() as i32
                        && sp_mac_navigation_valid(pid)
                }
        };
        let expected = path.clone();
        let expected_context = context.clone();
        on_main(&app, move || {
            if !valid() {
                return Err("文件管理器视图已改变，请重新预览。".into());
            }
            let (paths, selected_context) = selection(pid)?;
            if selected_context != expected_context
                || !paths
                    .iter()
                    .any(|p| std::fs::canonicalize(p).ok().as_ref() == Some(&expected))
            {
                return Err("文件管理器面板或选择已改变，请重新选中文件后预览。".into());
            }
            if !unsafe { sp_mac_navigate(pid, direction) } {
                return Err("无法切换文件管理器当前视图。".into());
            }
            Ok(())
        })?;
        for _ in 0..8 {
            std::thread::sleep(std::time::Duration::from_millis(60));
            let selected = on_main(&app, move || {
                if !valid() {
                    return Ok(None);
                }
                selection(pid).map(Some)
            })?;
            let Some((selected, selected_context)) = selected else {
                return Ok(None);
            };
            if selected_context != context {
                return Err("文件管理器面板已改变，请重新预览。".into());
            }
            if selected.len() != 1 {
                continue;
            }
            if let Some(next) = selected
                .into_iter()
                .find(|p| std::fs::canonicalize(p).ok().as_ref() != Some(&path))
            {
                return Ok(Some(next));
            }
        }
        Ok(None)
    })
    .await
    .map_err(|e| e.to_string())?
}
