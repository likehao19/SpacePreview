use serde::Serialize;
use std::{
    collections::HashSet,
    fs::{self, File},
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    sync::Mutex,
    time::UNIX_EPOCH,
};
use tauri::{Emitter, Manager, State};

mod autostart;
mod diagnostics;
mod dwg;
pub use dwg::worker_main as dwg_worker_main;
mod shortcut;
mod tray;
use autostart::{autostart_enabled, set_autostart};

#[tauri::command]
fn trace_preview(stage: String) {
    if matches!(
        stage.as_str(),
        "received"
            | "loaded"
            | "close"
            | "native-close"
            | "blur-close"
            | "dom-space"
            | "load-error"
    ) {
        diagnostics::record(format!("frontend {stage}"));
    }
}

#[cfg(windows)]
mod everything;
#[cfg(target_os = "macos")]
mod macos_agent;
#[cfg(any(target_os = "macos", test))]
mod macos_gesture;
#[cfg(target_os = "macos")]
mod macos_menu;
#[cfg(windows)]
mod quicklook_pipe;
#[cfg(windows)]
mod windows_agent;
#[cfg(windows)]
mod windows_icons;
#[cfg(windows)]
mod windows_presentation;

#[tauri::command]
fn agent_status() -> serde_json::Value {
    #[cfg(windows)]
    {
        windows_agent::status()
    }
    #[cfg(target_os = "macos")]
    {
        macos_agent::status()
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        serde_json::json!({"supported": false, "enabled": false, "running": false})
    }
}

#[tauri::command]
fn set_agent_enabled(enabled: bool) {
    #[cfg(windows)]
    windows_agent::set_enabled(enabled);
    #[cfg(target_os = "macos")]
    macos_agent::set_enabled(enabled);
    #[cfg(not(any(windows, target_os = "macos")))]
    let _ = enabled;
}

#[tauri::command]
fn set_agent_shortcut(shortcut: shortcut::Shortcut) -> Result<(), String> {
    let config = shortcut::set(shortcut)?;
    #[cfg(target_os = "macos")]
    macos_agent::set_shortcut(config);
    #[cfg(not(target_os = "macos"))]
    let _ = config;
    Ok(())
}

#[tauri::command]
fn request_agent_permissions(app: tauri::AppHandle, manager: Option<String>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if !matches!(manager.as_deref(), None | Some("finder") | Some("qspace")) {
            return Err("不支持此文件管理器".into());
        }
        macos_agent::request_permissions(app, manager.as_deref() == Some("qspace"))
            .map_err(|error| error.to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, manager);
        Ok(())
    }
}

#[tauri::command]
fn hide_preview(window: tauri::WebviewWindow) -> tauri::Result<()> {
    #[cfg(windows)]
    {
        windows_agent::hide_preview(&window)
    }
    #[cfg(target_os = "macos")]
    {
        macos_agent::hide_preview(&window)
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        window.hide()
    }
}

const MAX_READ: usize = 32 * 1024 * 1024;
#[derive(Default)]
struct PreviewState {
    allowed: Mutex<HashSet<PathBuf>>,
    startup: Mutex<(bool, Option<(Vec<String>, bool, bool)>)>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileInfo {
    id: String,
    name: String,
    path: String,
    size: u64,
    modified: u64,
    mime: String,
    directory: bool,
}

fn metadata(path: &Path) -> Result<FileInfo, String> {
    let info = fs::metadata(path).map_err(|e| e.to_string())?;
    if !info.is_file() && !info.is_dir() {
        return Err("此项目不是普通文件或文件夹。".into());
    }
    let name = path
        .file_name()
        .unwrap_or_else(|| path.as_os_str())
        .to_string_lossy()
        .to_string();
    let path = path.to_string_lossy().to_string();
    Ok(FileInfo {
        directory: info.is_dir(),
        id: path.clone(),
        mime: mime_guess::from_path(&path)
            .first_or_octet_stream()
            .to_string(),
        path,
        name,
        size: info.len(),
        modified: info
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0),
    })
}

#[tauri::command]
fn inspect_file(
    path: String,
    app: tauri::AppHandle,
    state: State<PreviewState>,
) -> Result<FileInfo, String> {
    let path = fs::canonicalize(path).map_err(|e| e.to_string())?;
    let info = metadata(&path)?;
    // Authorize exact files, never an entire drive. Only the local application can invoke this command.
    if !info.directory {
        app.asset_protocol_scope()
            .allow_file(&path)
            .map_err(|e| e.to_string())?;
    }
    state
        .allowed
        .lock()
        .map_err(|e| e.to_string())?
        .insert(path);
    Ok(info)
}

fn authorized(path: &str, state: &PreviewState) -> Result<PathBuf, String> {
    let path = fs::canonicalize(path).map_err(|e| e.to_string())?;
    if !state
        .allowed
        .lock()
        .map_err(|e| e.to_string())?
        .contains(&path)
    {
        return Err("请先选择此文件。".into());
    }
    Ok(path)
}

// User-clicked links may reach parent directories; passive HTML/image loads may not.
fn document_link_path(source: &Path, relative: &str) -> Result<PathBuf, String> {
    if ![
        "md",
        "markdown",
        "mdx",
        "mmd",
        "mdc",
        "mkd",
        "mdwn",
        "mdown",
        "qmd",
        "rmd",
        "rmarkdown",
        "apib",
        "mdtxt",
        "mdtext",
    ]
    .contains(
        &source
            .extension()
            .unwrap_or_default()
            .to_string_lossy()
            .to_ascii_lowercase()
            .as_str(),
    ) {
        return Err("请从 Markdown 文档打开文件链接".into());
    }
    if relative.is_empty()
        || relative.contains('\0')
        || relative.contains(':')
        || relative.starts_with('/')
        || relative.starts_with('\\')
        || Path::new(relative).is_absolute()
    {
        return Err("文件链接必须使用相对路径".into());
    }
    source
        .parent()
        .ok_or("文件所在目录无效")?
        .join(relative.replace('\\', "/"))
        .canonicalize()
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn resolve_document_link(
    path: String,
    relative: String,
    app: tauri::AppHandle,
    state: State<'_, PreviewState>,
) -> Result<FileInfo, String> {
    let source = authorized(&path, &state)?;
    let target =
        tauri::async_runtime::spawn_blocking(move || document_link_path(&source, &relative))
            .await
            .map_err(|error| error.to_string())??;
    inspect_file(target.to_string_lossy().into_owned(), app, state)
}

fn external_document_url(url: &str) -> Result<tauri::Url, String> {
    let url = tauri::Url::parse(url).map_err(|error| error.to_string())?;
    if !["https", "http"].contains(&url.scheme())
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("只支持 HTTP 或 HTTPS 网页链接".into());
    }
    Ok(url)
}

#[tauri::command]
fn open_document_url(url: String) -> Result<(), String> {
    let url = external_document_url(&url)?;
    open::that(url.as_str()).map_err(|error| error.to_string())
}

#[tauri::command]
async fn render_presentation(
    path: String,
    app: tauri::AppHandle,
    state: State<'_, PreviewState>,
) -> Result<FileInfo, String> {
    let source = authorized(&path, &state)?;
    let extension = source
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();
    if ![
        "pptx", "pptm", "potx", "potm", "ppsx", "ppsm", "ppt", "pps", "pot",
    ]
    .contains(&extension.as_str())
    {
        return Err("此文件不是支持的 PowerPoint 文稿。".into());
    }
    #[cfg(windows)]
    {
        let cache = app
            .path()
            .app_cache_dir()
            .map_err(|error| error.to_string())?
            .join("presentations");
        let output = tauri::async_runtime::spawn_blocking(move || {
            windows_presentation::render(&source, &cache)
        })
        .await
        .map_err(|error| error.to_string())??;
        inspect_file(output.to_string_lossy().into_owned(), app, state)
    }
    #[cfg(not(windows))]
    {
        let _ = (source, app);
        Err("此系统暂未接入原始幻灯片页面渲染，已切换文字速览。".into())
    }
}

#[tauri::command]
async fn file_icon(
    path: Option<String>,
    name: String,
    folder: bool,
    state: State<'_, PreviewState>,
) -> Result<tauri::ipc::Response, String> {
    let path = path.map(|path| authorized(&path, &state)).transpose()?;
    #[cfg(windows)]
    {
        let bytes = tauri::async_runtime::spawn_blocking(move || {
            windows_icons::read(path.as_deref(), &name, folder)
        })
        .await
        .map_err(|error| error.to_string())??;
        Ok(tauri::ipc::Response::new(bytes))
    }
    #[cfg(not(windows))]
    {
        let _ = (path, name, folder);
        Ok(tauri::ipc::Response::new(Vec::new()))
    }
}

#[tauri::command]
async fn read_prefix(
    path: String,
    limit: usize,
    state: State<'_, PreviewState>,
) -> Result<tauri::ipc::Response, String> {
    let path = authorized(&path, &state)?;
    let bytes = tauri::async_runtime::spawn_blocking(move || read_bounded(&path, limit))
        .await
        .map_err(|e| e.to_string())??;
    Ok(tauri::ipc::Response::new(bytes))
}

fn read_bounded(path: &Path, limit: usize) -> Result<Vec<u8>, String> {
    read_at(path, 0, limit)
}

#[tauri::command]
async fn read_range(
    path: String,
    offset: u64,
    limit: usize,
    state: State<'_, PreviewState>,
) -> Result<tauri::ipc::Response, String> {
    let path = authorized(&path, &state)?;
    let bytes = tauri::async_runtime::spawn_blocking(move || read_at(&path, offset, limit))
        .await
        .map_err(|e| e.to_string())??;
    Ok(tauri::ipc::Response::new(bytes))
}

// Resources stay inside the selected HTML's directory, including through symlinks.
fn html_resource_path(source: &Path, relative: &str) -> Result<PathBuf, String> {
    let root = source.parent().ok_or("HTML 所在目录无效")?;
    let path = root
        .join(relative)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    if Path::new(relative).is_absolute() || !path.starts_with(root) {
        return Err("资源必须位于 HTML 所在目录内".into());
    }
    let extension = path
        .extension()
        .and_then(|v| v.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if ![
        "css", "png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "woff", "woff2", "ttf", "otf",
    ]
    .contains(&extension.as_str())
    {
        return Err("不支持此资源类型".into());
    }
    Ok(path)
}

#[tauri::command]
async fn read_html_resource(
    path: String,
    relative: String,
    state: State<'_, PreviewState>,
) -> Result<tauri::ipc::Response, String> {
    let source = authorized(&path, &state)?;
    let bytes = tauri::async_runtime::spawn_blocking(move || -> Result<Vec<u8>, String> {
        let resource = html_resource_path(&source, &relative)?;
        let bytes = read_bounded(&resource, 8 * 1024 * 1024 + 1)?;
        if bytes.len() > 8 * 1024 * 1024 {
            return Err("资源超过 8 MB 上限".into());
        }
        Ok(bytes)
    })
    .await
    .map_err(|e| e.to_string())??;
    Ok(tauri::ipc::Response::new(bytes))
}

fn read_at(path: &Path, offset: u64, limit: usize) -> Result<Vec<u8>, String> {
    if limit > MAX_READ {
        return Err("读取超过 32 MB 上限。".into());
    }
    let mut file = File::open(path).map_err(|e| e.to_string())?;
    if !file.metadata().map_err(|e| e.to_string())?.is_file() {
        return Err("仅支持普通文件。".into());
    }
    let mut bytes = Vec::new();
    file.seek(SeekFrom::Start(offset))
        .map_err(|e| e.to_string())?;
    file.take(limit as u64)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    Ok(bytes)
}

#[tauri::command]
fn cancel_file_navigation() {
    #[cfg(target_os = "macos")]
    macos_agent::cancel_navigation();
    #[cfg(windows)]
    windows_agent::cancel_navigation();
}

#[tauri::command]
async fn navigate_file_selection(
    app: tauri::AppHandle,
    path: String,
    direction: i32,
    state: State<'_, PreviewState>,
) -> Result<Option<String>, String> {
    if direction != -1 && direction != 1 {
        return Err("无效的切换方向".into());
    }
    let current = authorized(&path, &state)?;
    #[cfg(target_os = "macos")]
    return macos_agent::navigate(app, current, direction).await;
    #[cfg(windows)]
    return windows_agent::navigate(app, current, direction).await;
    #[cfg(not(any(target_os = "macos", windows)))]
    {
        let _ = (app, current);
        Err("此平台尚未接入文件管理器视图导航。".into())
    }
}

#[tauri::command]
fn open_project_page(page: String) -> Result<(), String> {
    let url = match page.as_str() {
        "repository" => "https://github.com/likehao19/SpacePreview",
        "releases" => "https://github.com/likehao19/SpacePreview/releases",
        _ => return Err("未知的项目页面".into()),
    };
    open::that(url).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_default(path: String, state: State<PreviewState>) -> Result<(), String> {
    let path = authorized(&path, &state)?;
    let ext = path
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();
    if [
        "exe",
        "com",
        "bat",
        "cmd",
        "ps1",
        "vbs",
        "vbe",
        "js",
        "jse",
        "wsf",
        "wsh",
        "msi",
        "scr",
        "lnk",
        "url",
        "sh",
        "command",
        "app",
        "py",
        "pyw",
        "pyc",
        "pyo",
        "pyz",
        "mjs",
        "cjs",
        "psm1",
        "rb",
        "rbw",
        "pl",
        "php",
        "lua",
        "jar",
        "jnlp",
        "hta",
        "reg",
        "cpl",
        "msc",
        "msp",
        "msix",
        "msixbundle",
        "appx",
        "appxbundle",
    ]
    .contains(&ext.as_str())
    {
        return Err("预览器不启动可执行文件或脚本，请在文件管理器中自行打开。".into());
    }
    open::that_detached(path).map_err(|e| e.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DirectoryPage {
    entries: Vec<FileInfo>,
    next_offset: Option<usize>,
}

// Read only one level and one bounded page. Never follow links outside this directory.
fn directory_page(path: &Path, offset: usize) -> Result<DirectoryPage, String> {
    let mut source = fs::read_dir(path).map_err(|e| e.to_string())?.skip(offset);
    let mut entries = Vec::new();
    let mut consumed = 0;
    for entry in source.by_ref().take(500) {
        consumed += 1;
        let entry = entry.map_err(|e| e.to_string())?;
        let Ok(canonical) = fs::canonicalize(entry.path()) else {
            continue;
        };
        if !canonical.starts_with(path) || canonical == path {
            continue;
        }
        if let Ok(info) = metadata(&canonical) {
            entries.push(info);
        }
    }
    entries.sort_by(|a, b| {
        b.directory
            .cmp(&a.directory)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(DirectoryPage {
        entries,
        next_offset: source.next().map(|_| offset + consumed),
    })
}

#[tauri::command]
async fn list_directory(
    path: String,
    offset: usize,
    app: tauri::AppHandle,
    state: State<'_, PreviewState>,
) -> Result<DirectoryPage, String> {
    let path = authorized(&path, &state)?;
    let page = tauri::async_runtime::spawn_blocking(move || directory_page(&path, offset))
        .await
        .map_err(|e| e.to_string())??;
    let mut allowed = state.allowed.lock().map_err(|e| e.to_string())?;
    for entry in &page.entries {
        if !entry.directory {
            app.asset_protocol_scope()
                .allow_file(&entry.path)
                .map_err(|e| e.to_string())?;
        }
        allowed.insert(PathBuf::from(&entry.path));
    }
    Ok(page)
}

fn argument_paths(args: impl Iterator<Item = String>) -> Vec<String> {
    args.filter(|a| !a.starts_with('-'))
        .filter(|a| Path::new(a).is_file() || Path::new(a).is_dir())
        .collect()
}

#[tauri::command]
fn initial_paths(state: State<PreviewState>) -> Result<serde_json::Value, String> {
    let mut startup = state.startup.lock().map_err(|error| error.to_string())?;
    let (paths, text, file_manager) = startup.1.take().unwrap_or_else(|| {
        (
            argument_paths(std::env::args().skip(1)),
            std::env::args().any(|arg| arg == "--text"),
            false,
        )
    });
    startup.0 = true;
    Ok(serde_json::json!({ "paths": paths, "text": text, "fileManager": file_manager }))
}

fn show_preview_files(app: &tauri::AppHandle, paths: Vec<String>, text: bool, file_manager: bool) {
    if let Some(window) = app.get_webview_window("main") {
        // macOS reveals file previews after the WebView resolves their initial size.
        #[cfg(target_os = "macos")]
        if !paths.is_empty() {
            let _ = window.hide();
        }
        if !cfg!(target_os = "macos") || paths.is_empty() {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
        if !paths.is_empty() {
            let state = app.state::<PreviewState>();
            if let Ok(mut startup) = state.startup.lock() {
                if startup.0 {
                    let _ = window.emit(
                        "preview-files",
                        serde_json::json!({ "paths": paths, "text": text, "fileManager": file_manager }),
                    );
                } else {
                    // macOS can deliver Dock/Open With files before the WebView subscribes.
                    startup.1 = Some((paths, text, file_manager));
                }
            };
        }
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _| {
            if autostart::background_launch(&args) {
                return;
            }
            let text = args.iter().any(|a| a == "--text");
            let paths = argument_paths(args.into_iter().skip(1));
            show_preview_files(app, paths, text, false);
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(PreviewState::default())
        .invoke_handler(tauri::generate_handler![
            inspect_file,
            resolve_document_link,
            open_document_url,
            file_icon,
            render_presentation,
            read_prefix,
            read_range,
            read_html_resource,
            navigate_file_selection,
            cancel_file_navigation,
            list_directory,
            open_default,
            dwg::read_dwg,
            dwg::cancel_dwg,
            open_project_page,
            initial_paths,
            autostart_enabled,
            set_autostart,
            tray::tray_visible,
            tray::set_tray_visible,
            agent_status,
            trace_preview,
            hide_preview,
            set_agent_enabled,
            set_agent_shortcut,
            request_agent_permissions
        ])
        .setup(|app| {
            app.manage(autostart::configure()?);
            diagnostics::start();
            #[cfg(windows)]
            windows_agent::start(app.handle().clone());
            #[cfg(windows)]
            quicklook_pipe::start(app.handle().clone());
            #[cfg(target_os = "macos")]
            {
                macos_agent::start(app.handle().clone());
                macos_menu::install(app)?;
            }
            tray::configure(app)?;
            if !autostart::background_launch(&std::env::args().collect::<Vec<_>>()) {
                if let Some(window) = app.get_webview_window("main") {
                    window.show()?;
                    window.set_focus()?;
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.emit("preview-closed", ());
                if let Some(webview) = window.app_handle().get_webview_window(window.label()) {
                    let _ = hide_preview(webview);
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("启动瞬览失败")
        .run(|app, event| {
            #[cfg(target_os = "macos")]
            match event {
                tauri::RunEvent::Opened { urls } => {
                    let paths = urls
                        .into_iter()
                        .filter_map(|url| url.to_file_path().ok())
                        .filter(|path| path.is_file())
                        .take(100)
                        .map(|path| path.to_string_lossy().into_owned())
                        .collect();
                    show_preview_files(app, paths, false, false);
                }
                tauri::RunEvent::Reopen {
                    has_visible_windows,
                    ..
                } if !has_visible_windows => {
                    show_preview_files(app, Vec::new(), false, false);
                }
                _ => (),
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app, event);
        });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bounded_reads_do_not_load_the_whole_file() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("Cargo.toml");
        assert_eq!(read_bounded(&path, 8).unwrap().len(), 8);
        assert!(read_bounded(&path, MAX_READ + 1).is_err());
        let all = fs::read(&path).unwrap();
        assert_eq!(read_at(&path, 4, 8).unwrap(), all[4..12]);
        assert!(read_at(&path, all.len() as u64 + 1, 8).unwrap().is_empty());
    }
    #[test]
    fn unselected_files_cannot_be_read() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("Cargo.toml");
        assert!(authorized(path.to_str().unwrap(), &PreviewState::default()).is_err());
    }
    #[test]
    fn clicked_markdown_links_resolve_relative_files_without_reading_them() {
        let root = std::env::temp_dir().join(format!("spacepreview-links-{}", std::process::id()));
        fs::create_dir_all(root.join("docs")).unwrap();
        fs::write(root.join("docs/README.md"), b"markdown").unwrap();
        fs::write(root.join("docs/开始 使用.md"), b"target").unwrap();
        fs::write(root.join("report.pdf"), b"pdf").unwrap();
        let root = fs::canonicalize(root).unwrap();
        let source = root.join("docs/README.md");
        assert_eq!(
            document_link_path(&source, "./开始 使用.md").unwrap(),
            root.join("docs/开始 使用.md")
        );
        assert_eq!(
            document_link_path(&source, "..\\report.pdf").unwrap(),
            root.join("report.pdf")
        );
        assert_eq!(document_link_path(&source, "..").unwrap(), root);
        assert!(document_link_path(&source, "missing.md").is_err());
        for value in [
            "",
            "/etc/passwd",
            "C:\\file.md",
            "\\\\host\\file",
            "file:///etc/passwd",
            "https://example.com",
            "bad\0.md",
        ] {
            assert!(document_link_path(&source, value).is_err(), "{value}");
        }
        assert!(document_link_path(&root.join("index.html"), "report.pdf").is_err());
        // A click grants its target later, not access to arbitrary sibling files here.
        assert!(authorized(
            root.join("report.pdf").to_str().unwrap(),
            &PreviewState::default()
        )
        .is_err());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn document_external_links_cannot_launch_custom_protocols() {
        assert!(external_document_url("https://example.com/docs#section").is_ok());
        assert!(external_document_url("http://example.com").is_ok());
        for value in [
            "file:///tmp/a",
            "javascript:alert(1)",
            "mailto:a@example.com",
            "https://user:pass@example.com",
            "not a URL",
        ] {
            assert!(external_document_url(value).is_err(), "{value}");
        }
    }
    #[test]
    fn directory_preview_is_shallow_and_paginated() {
        let root = std::env::temp_dir().join(format!("spacepreview-tree-{}", std::process::id()));
        fs::create_dir_all(root.join("nested/deep")).unwrap();
        for index in 0..502 {
            fs::write(root.join(format!("file-{index}.txt")), b"test").unwrap();
        }
        let root = fs::canonicalize(root).unwrap();
        assert!(metadata(&root).unwrap().directory);
        let first = directory_page(&root, 0).unwrap();
        assert_eq!(first.entries.len(), 500);
        assert_eq!(first.next_offset, Some(500));
        let second = directory_page(&root, 500).unwrap();
        assert_eq!(second.entries.len(), 3);
        assert_eq!(second.next_offset, None);
        let ids: HashSet<_> = first
            .entries
            .iter()
            .chain(second.entries.iter())
            .map(|entry| &entry.id)
            .collect();
        assert_eq!(ids.len(), 503);
        assert!(first
            .entries
            .iter()
            .chain(second.entries.iter())
            .all(|entry| entry.name != "deep"));
        assert!(read_bounded(&root, 8).is_err());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn html_assets_cannot_escape_selected_directory() {
        let root = std::env::temp_dir().join(format!("spacepreview-html-{}", std::process::id()));
        fs::create_dir_all(root.join("css")).unwrap();
        fs::write(root.join("index.html"), b"html").unwrap();
        fs::write(root.join("css/main.css"), b"body{}").unwrap();
        fs::write(root.join("private.txt"), b"secret").unwrap();
        let root = fs::canonicalize(root).unwrap();
        let source = root.join("index.html");
        assert_eq!(
            html_resource_path(&source, "css/main.css").unwrap(),
            root.join("css/main.css")
        );
        assert!(html_resource_path(&source, "private.txt").is_err());
        assert!(html_resource_path(&source, source.to_str().unwrap()).is_err());
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink("/etc", root.join("outside")).unwrap();
            assert!(html_resource_path(&source, "outside/passwd").is_err());
        }
        fs::remove_dir_all(root).unwrap();
    }
}
