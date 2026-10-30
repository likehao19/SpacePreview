//! In-process Windows integration. The hook only inspects native focus and queues work;
//! Shell COM runs on its own apartment so it can never stall keyboard delivery.
use std::{
    cell::Cell,
    path::Path,
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        mpsc::{sync_channel, SyncSender},
        OnceLock,
    },
};
use tauri::{AppHandle, Emitter, Manager};
use windows::{
    core::Interface,
    Win32::{
        Foundation::{E_NOTIMPL, HWND, LPARAM, LRESULT, WPARAM},
        System::{
            Com::{
                CoCreateInstance, CoInitializeEx, CoTaskMemFree, IDispatch, IServiceProvider,
                CLSCTX_ALL, COINIT_APARTMENTTHREADED,
            },
            LibraryLoader::GetModuleHandleW,
            Variant::VARIANT,
        },
        UI::{
            Input::KeyboardAndMouse::GetAsyncKeyState,
            Shell::{
                IFolderView2, IShellBrowser, IShellWindows, IWebBrowserApp, SID_STopLevelBrowser,
                ShellWindows, SIGDN_FILESYSPATH, SVGIO_SELECTION, SWC_DESKTOP, SWFO_NEEDDISPATCH,
            },
            WindowsAndMessaging::*,
        },
    },
};

static ENABLED: AtomicBool = AtomicBool::new(true);
static RUNNING: AtomicBool = AtomicBool::new(false);
static COM_READY: AtomicBool = AtomicBool::new(false);
static SOURCE_WINDOW: AtomicUsize = AtomicUsize::new(0);
static REQUESTS: OnceLock<SyncSender<(usize, bool)>> = OnceLock::new();
#[derive(Clone, Copy, Default)]
struct SpaceGesture {
    held: bool,
    pending: Option<(usize, bool)>,
}

impl SpaceGesture {
    fn keydown(&mut self, candidate: Option<(usize, bool)>) -> bool {
        if !self.held {
            self.held = true;
            self.pending = candidate;
        }
        self.pending.is_some()
    }

    fn keyup(&mut self) -> Option<(usize, bool)> {
        // Clear state BEFORE sending a request that can change window focus.
        self.held = false;
        self.pending.take()
    }
}

thread_local! { static SPACE: Cell<SpaceGesture> = const { Cell::new(SpaceGesture { held: false, pending: None }) }; }
thread_local! { static SHORTCUT_CONFIG: Cell<u32> = const { Cell::new(32 | (49 << 8)) }; }

pub fn set_enabled(enabled: bool) {
    ENABLED.store(enabled, Ordering::Relaxed);
}
pub fn status() -> serde_json::Value {
    serde_json::json!({"supported": true, "enabled": ENABLED.load(Ordering::Relaxed), "running": RUNNING.load(Ordering::Relaxed) && COM_READY.load(Ordering::Relaxed)})
}

pub fn hide_preview(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    crate::diagnostics::record("native hide-preview");
    unsafe {
        let was_foreground = GetForegroundWindow().0 == window.hwnd()?.0;
        window.hide()?;
        let source = HWND(SOURCE_WINDOW.swap(0, Ordering::Relaxed) as *mut _);
        // Explicitly return keyboard focus after closing. On blur, preserve the
        // other app the user chose instead of activating Explorer over it.
        if was_foreground && !source.0.is_null() && IsWindow(Some(source)).as_bool() {
            let _ = SetForegroundWindow(source);
        }
    }
    Ok(())
}

unsafe fn class_name(hwnd: HWND) -> String {
    let mut buffer = [0u16; 128];
    let length = GetClassNameW(hwnd, &mut buffer);
    String::from_utf16_lossy(&buffer[..length.max(0) as usize])
}

unsafe fn file_list_has_focus(foreground: HWND) -> bool {
    if !matches!(
        class_name(foreground).as_str(),
        "CabinetWClass" | "ExploreWClass" | "Progman" | "WorkerW"
    ) {
        return false;
    }
    let mut info = GUITHREADINFO {
        cbSize: std::mem::size_of::<GUITHREADINFO>() as u32,
        ..Default::default()
    };
    if GetGUIThreadInfo(GetWindowThreadProcessId(foreground, None), &mut info).is_err() {
        return false;
    }
    // A Shell list can retain a caret after focus returns from the preview.
    // Only the focused control and its ancestry determine whether this is a file list.
    // Edit/address/search controls and the navigation tree retain normal Space input.
    if !matches!(
        class_name(info.hwndFocus).as_str(),
        "DirectUIHWND" | "SysListView32" | "SHELLDLL_DefView"
    ) {
        return false;
    }
    let mut current = info.hwndFocus;
    for _ in 0..12 {
        if class_name(current) == "SHELLDLL_DefView" {
            return true;
        }
        if current == foreground {
            break;
        }
        current = match GetParent(current) {
            Ok(parent) => parent,
            Err(_) => break,
        };
    }
    false
}

unsafe extern "system" fn keyboard_hook(code: i32, message: WPARAM, data: LPARAM) -> LRESULT {
    if code >= 0 {
        let key = &*(data.0 as *const KBDLLHOOKSTRUCT);
        let config = crate::shortcut::current();
        if SHORTCUT_CONFIG.replace(config) != config {
            SPACE.set(SpaceGesture::default());
        }
        if key.vkCode == config & 255 {
            if crate::diagnostics::enabled() {
                let foreground = GetForegroundWindow();
                let mut info = GUITHREADINFO {
                    cbSize: std::mem::size_of::<GUITHREADINFO>() as u32,
                    ..Default::default()
                };
                let _ = GetGUIThreadInfo(GetWindowThreadProcessId(foreground, None), &mut info);
                crate::diagnostics::record(format!("key msg={} time={} flags={} held={} suppress={} fg={:?}/{} focus={} eligible={} enabled={}", message.0, key.time, key.flags.0, SPACE.get().held, SPACE.get().pending.is_some(), foreground, class_name(foreground), class_name(info.hwndFocus), file_list_has_focus(foreground), ENABLED.load(Ordering::Relaxed)));
            }
            if message.0 == WM_KEYUP as usize || message.0 == WM_SYSKEYUP as usize {
                let mut gesture = SPACE.get();
                let pending = gesture.keyup();
                SPACE.set(gesture);
                if let Some(request) = pending {
                    if ENABLED.load(Ordering::Relaxed) {
                        if let Some(sender) = REQUESTS.get() {
                            let queued = sender.try_send(request);
                            crate::diagnostics::record(format!(
                                "release request queued={}",
                                queued.is_ok()
                            ));
                        }
                    }
                    return LRESULT(1);
                }
            } else if message.0 == WM_KEYDOWN as usize || message.0 == WM_SYSKEYDOWN as usize {
                let foreground = GetForegroundWindow();
                let eligible = ENABLED.load(Ordering::Relaxed)
                    && crate::shortcut::matches(
                        config,
                        GetAsyncKeyState(0x11) < 0,
                        GetAsyncKeyState(0x12) < 0,
                        GetAsyncKeyState(0x5B) < 0 || GetAsyncKeyState(0x5C) < 0,
                    )
                    && file_list_has_focus(foreground);
                let candidate =
                    eligible.then(|| (foreground.0 as usize, GetAsyncKeyState(0x10) < 0));
                let mut gesture = SPACE.get();
                let suppress = gesture.keydown(candidate);
                SPACE.set(gesture);
                if suppress {
                    return LRESULT(1);
                }
            }
        }
    }
    CallNextHookEx(None, code, message, data)
}

unsafe fn focused_window(foreground: HWND) -> Option<HWND> {
    let mut info = GUITHREADINFO {
        cbSize: std::mem::size_of::<GUITHREADINFO>() as u32,
        ..Default::default()
    };
    GetGUIThreadInfo(GetWindowThreadProcessId(foreground, None), &mut info).ok()?;
    (!info.hwndFocus.0.is_null()).then_some(info.hwndFocus)
}

unsafe fn paths_from_browser(
    dispatch: IDispatch,
    foreground: HWND,
    desktop: bool,
) -> windows::core::Result<Vec<String>> {
    if !desktop {
        let browser: IWebBrowserApp = dispatch.cast()?;
        if browser.HWND()?.0 != foreground.0 as isize {
            return Ok(Vec::new());
        }
    }
    let provider: IServiceProvider = dispatch.cast()?;
    let browser: IShellBrowser = provider.QueryService(&SID_STopLevelBrowser)?;
    let view = browser.QueryActiveShellView()?;
    let view_window = view.GetWindow()?;
    if !IsWindowVisible(view_window).as_bool() {
        return Ok(Vec::new());
    }
    // Windows 11 tabs share one top-level window and inactive tab views can still
    // report visible. Only the view holding keyboard focus is the active tab.
    if !desktop
        && !focused_window(foreground)
            .is_some_and(|focus| focus == view_window || IsChild(view_window, focus).as_bool())
    {
        return Ok(Vec::new());
    }
    let folder: IFolderView2 = view.cast()?;
    if folder.ItemCount(SVGIO_SELECTION)? == 0 {
        return Ok(Vec::new());
    }
    let items = folder.GetSelection(false)?;
    let mut paths = Vec::new();
    let count = items.GetCount()?;
    let mut directories = 0;
    let mut filesystem_items = 0;
    for index in 0..count.min(100) {
        let item = items.GetItemAt(index)?;
        if let Ok(raw) = item.GetDisplayName(SIGDN_FILESYSPATH) {
            let path = raw.to_string();
            CoTaskMemFree(Some(raw.0.cast()));
            if let Ok(path) = path {
                filesystem_items += 1;
                if Path::new(&path).is_file() {
                    paths.push(path);
                } else if Path::new(&path).is_dir() {
                    directories += 1;
                    paths.push(path);
                }
            }
        }
    }
    crate::diagnostics::record(format!("selection items={count} files={} directories={directories} filesystem_items={filesystem_items}", paths.len()));
    if paths.is_empty() && count > 0 {
        let message = if filesystem_items == 0 {
            "所选项目没有本地文件路径，暂不支持此类系统图标预览。"
        } else {
            "所选文件不存在或无法读取，请检查文件是否可访问。"
        };
        return Err(windows::core::Error::new(E_NOTIMPL, message));
    }
    Ok(paths)
}

unsafe fn selected_paths(foreground: HWND) -> windows::core::Result<Vec<String>> {
    let shell: IShellWindows = CoCreateInstance(&ShellWindows, None, CLSCTX_ALL)?;
    if matches!(class_name(foreground).as_str(), "Progman" | "WorkerW") {
        let empty = VARIANT::default();
        let location = VARIANT::from(0i32); // CSIDL_DESKTOP
        let mut handle = 0;
        let desktop = shell.FindWindowSW(
            &location,
            &empty,
            SWC_DESKTOP,
            &mut handle,
            SWFO_NEEDDISPATCH,
        )?;
        return paths_from_browser(desktop, foreground, true);
    }
    let mut selection_error = None;
    for index in 0..shell.Count()? {
        if let Ok(dispatch) = shell.Item(&VARIANT::from(index)) {
            match paths_from_browser(dispatch, foreground, false) {
                Ok(paths) if !paths.is_empty() => return Ok(paths),
                Err(error) => selection_error = Some(error),
                _ => (),
            }
        }
    }
    selection_error.map_or_else(|| Ok(Vec::new()), Err)
}

pub fn start(app: AppHandle) {
    let (sender, receiver) = sync_channel::<(usize, bool)>(1);
    if REQUESTS.set(sender).is_err() {
        return;
    }
    std::thread::spawn(move || unsafe {
        if CoInitializeEx(None, COINIT_APARTMENTTHREADED).is_err() {
            return;
        }
        COM_READY.store(true, Ordering::Relaxed);
        while let Ok((handle, text)) = receiver.recv() {
            crate::diagnostics::record("worker received");
            let foreground = HWND(handle as *mut _);
            // Focus was validated when the key was pressed. Rechecking child focus here
            // used to silently discard an accepted press during Explorer focus changes.
            if GetForegroundWindow() != foreground {
                crate::diagnostics::record("worker cancelled: foreground changed");
                continue;
            }
            let paths = read_selection(
                || GetForegroundWindow() == foreground,
                || selected_paths(foreground),
                || std::thread::sleep(std::time::Duration::from_millis(30)),
            );
            match paths {
                Ok(paths) if !paths.is_empty() && GetForegroundWindow() == foreground => {
                    crate::diagnostics::record(format!("selection count={}", paths.len()));
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = app.run_on_main_thread(move || {
                            // The COM result may have waited in the UI queue.
                            if GetForegroundWindow().0 as usize != handle {
                                crate::diagnostics::record("UI cancelled: foreground changed");
                                return;
                            }
                            SOURCE_WINDOW.store(handle, Ordering::Relaxed);
                            let show = window.show();
                            let restore = window.unminimize();
                            let focus = window.set_focus();
                            crate::diagnostics::record(format!(
                                "UI show={show:?} restore={restore:?} focus={focus:?} visible={:?}",
                                window.is_visible()
                            ));
                            let emit = window.emit(
                                "preview-files",
                                serde_json::json!({"paths": paths, "text": text}),
                            );
                            crate::diagnostics::record(format!("UI emit={emit:?}"));
                        });
                    }
                }
                result => {
                    let message = match result {
                        Err(error) => format!("{}", error.message()),
                        _ => "没有读取到普通文件，请选中文件后再按 Space。".into(),
                    };
                    crate::diagnostics::record(format!("selection unavailable: {message}"));

                }
            }
        }
    });
    std::thread::spawn(move || unsafe {
        let module = GetModuleHandleW(None).ok().map(|m| m.into());
        if let Ok(hook) = SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_hook), module, 0) {
            RUNNING.store(true, Ordering::Relaxed);
            let mut message = MSG::default();
            while GetMessageW(&mut message, None, 0, 0).0 > 0 {
                let _ = TranslateMessage(&message);
                DispatchMessageW(&message);
            }
            let _ = UnhookWindowsHookEx(hook);
            RUNNING.store(false, Ordering::Relaxed);
        }
    });
}

// Explorer can publish a new selection just after a click. Retry the same press
// briefly on the COM worker, never on the keyboard hook, and stop if the user leaves.
fn read_selection(
    mut still_current: impl FnMut() -> bool,
    mut read: impl FnMut() -> windows::core::Result<Vec<String>>,
    mut pause: impl FnMut(),
) -> windows::core::Result<Vec<String>> {
    for attempt in 0..4 {
        if !still_current() {
            return Ok(Vec::new());
        }
        let result = read();
        if result.as_ref().is_ok_and(|paths| !paths.is_empty()) || attempt == 3 {
            return result;
        }
        pause();
    }
    unreachable!()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn consecutive_previews_dispatch_once_on_release_and_reset_before_focus_changes() {
        let mut gesture = SpaceGesture::default();
        for source in [1, 2, 3, 4, 5] {
            assert!(gesture.keydown(Some((source, false))));
            // Holding Space must neither dispatch early nor replace the captured source.
            assert!(gesture.keydown(Some((99, true))));
            assert_eq!(gesture.keyup(), Some((source, false)));
            assert!(!gesture.held);
            assert_eq!(gesture.pending, None);
            // The preview can now appear/disappear without losing a required key-up.
            assert_eq!(gesture.keyup(), None);
        }
    }

    #[test]
    fn typing_and_closing_in_preview_do_not_arm_an_explorer_request() {
        let mut gesture = SpaceGesture::default();
        assert!(!gesture.keydown(None));
        assert!(!gesture.keydown(Some((1, false))));
        assert_eq!(gesture.keyup(), None);
        assert!(gesture.keydown(Some((2, true))));
        assert_eq!(gesture.keyup(), Some((2, true)));
    }

    #[test]
    fn one_press_waits_for_explorer_to_publish_selection() {
        let mut reads = 0;
        let paths = read_selection(
            || true,
            || {
                reads += 1;
                Ok(if reads < 3 {
                    vec![]
                } else {
                    vec!["next.txt".into()]
                })
            },
            || {},
        )
        .unwrap();
        assert_eq!(paths, vec!["next.txt"]);
        assert_eq!(reads, 3);
    }

    #[test]
    fn selection_retry_is_bounded_and_does_not_steal_focus() {
        let mut reads = 0;
        read_selection(
            || true,
            || {
                reads += 1;
                Ok(vec![])
            },
            || {},
        )
        .unwrap();
        assert_eq!(reads, 4);
        let active = Cell::new(true);
        let mut reads = 0;
        let paths = read_selection(
            || active.get(),
            || {
                reads += 1;
                Ok(vec![])
            },
            || active.set(false),
        )
        .unwrap();
        assert!(paths.is_empty());
        assert_eq!(reads, 1);
    }

    #[test]
    fn unrelated_windows_never_qualify_for_space_preview() {
        unsafe {
            assert!(!file_list_has_focus(HWND::default()));
        }
    }

    #[test]
    #[ignore = "requires an interactive Windows user session"]
    fn shell_com_and_keyboard_hook_are_available() {
        // Register a pass-through hook, never inject keys or modify Explorer selection.
        unsafe extern "system" fn passthrough(code: i32, w: WPARAM, l: LPARAM) -> LRESULT {
            CallNextHookEx(None, code, w, l)
        }
        unsafe {
            CoInitializeEx(None, COINIT_APARTMENTTHREADED).unwrap();
            let shell: IShellWindows = CoCreateInstance(&ShellWindows, None, CLSCTX_ALL).unwrap();
            assert!(shell.Count().unwrap() >= 0);
            let mut desktop_handle = 0;
            let desktop = shell
                .FindWindowSW(
                    &VARIANT::from(0i32),
                    &VARIANT::default(),
                    SWC_DESKTOP,
                    &mut desktop_handle,
                    SWFO_NEEDDISPATCH,
                )
                .unwrap();
            match paths_from_browser(desktop, HWND(desktop_handle as isize as *mut _), true) {
                Ok(paths) => println!(
                    "Desktop Shell connection ready; selected regular files: {}",
                    paths.len()
                ),
                Err(error) if error.code() == E_NOTIMPL => println!(
                    "Desktop Shell connection ready; selection is not a supported regular file"
                ),
                Err(error) => panic!("Desktop Shell connection failed: {error}"),
            }
            for index in 0..shell.Count().unwrap() {
                if let Ok(dispatch) = shell.Item(&VARIANT::from(index)) {
                    if let Ok(browser) = dispatch.cast::<IWebBrowserApp>() {
                        if let Ok(handle) = browser.HWND() {
                            let hwnd = HWND(handle.0 as *mut _);
                            let mut info = GUITHREADINFO {
                                cbSize: std::mem::size_of::<GUITHREADINFO>() as u32,
                                ..Default::default()
                            };
                            let _ =
                                GetGUIThreadInfo(GetWindowThreadProcessId(hwnd, None), &mut info);
                            println!("Shell view: window={}, focus={}, caret={}, eligible={}, selected_files={:?}", class_name(hwnd), class_name(info.hwndFocus), !info.hwndCaret.0.is_null(), file_list_has_focus(hwnd), paths_from_browser(dispatch, hwnd, false).map(|paths| paths.len()));
                        }
                    }
                }
            }
            let module = GetModuleHandleW(None).unwrap();
            let hook = SetWindowsHookExW(WH_KEYBOARD_LL, Some(passthrough), Some(module.into()), 0)
                .unwrap();
            UnhookWindowsHookEx(hook).unwrap();
            windows::Win32::System::Com::CoUninitialize();
        }
    }
}
