use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem, SubmenuBuilder},
    App, AppHandle, Emitter, Manager,
};

pub fn install(app: &App) -> tauri::Result<()> {
    extern "C" {
        fn sp_mac_configure_window(window: *mut std::ffi::c_void);
    }
    if let Some(window) = app.get_webview_window("main") {
        // setup runs on the main thread, as required by AppKit.
        unsafe { sp_mac_configure_window(window.ns_window()?) };
    }
    let settings = MenuItem::with_id(app, "settings", "设置…", true, Some("Cmd+,"))?;
    let open = MenuItem::with_id(app, "open", "打开…", true, Some("Cmd+O"))?;
    let application = SubmenuBuilder::new(app, "瞬览")
        .text("about", "关于瞬览")
        .separator()
        .item(&settings)
        .separator()
        .services_with_text("服务")
        .separator()
        .hide_with_text("隐藏瞬览")
        .hide_others_with_text("隐藏其他")
        .show_all_with_text("显示全部")
        .separator()
        .quit_with_text("退出瞬览")
        .build()?;
    let file = SubmenuBuilder::new(app, "文件")
        .item(&open)
        .separator()
        .close_window_with_text("关闭窗口")
        .build()?;
    let edit = SubmenuBuilder::new(app, "编辑")
        .undo_with_text("撤销")
        .redo_with_text("重做")
        .separator()
        .cut_with_text("剪切")
        .copy_with_text("复制")
        .paste_with_text("粘贴")
        .select_all_with_text("全选")
        .build()?;
    let window = SubmenuBuilder::new(app, "窗口")
        .minimize_with_text("最小化")
        .maximize_with_text("缩放")
        .fullscreen_with_text("进入全屏幕")
        .separator()
        .bring_all_to_front_with_text("前置全部窗口")
        .build()?;
    let help = SubmenuBuilder::new(app, "帮助")
        .text("guide", "瞬览使用指南")
        .build()?;
    app.set_menu(Menu::with_items(
        app,
        &[&application, &file, &edit, &window, &help],
    )?)?;
    window.set_as_windows_menu_for_nsapp()?;
    help.set_as_help_menu_for_nsapp()?;
    // App-wide events also cover the status item's menu while the window is hidden.
    app.on_menu_event(|app, event| {
        let action = event.id.as_ref();
        if matches!(action, "open" | "settings" | "about" | "guide") {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
                let _ = window.emit("app-menu", action);
            }
        }
    });
    Ok(())
}

pub fn tray_menu(
    app: &AppHandle,
    show: &MenuItem<tauri::Wry>,
    quit: &MenuItem<tauri::Wry>,
) -> tauri::Result<Menu<tauri::Wry>> {
    Menu::with_items(
        app,
        &[
            show,
            &MenuItem::with_id(app, "open", "打开文件…", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "settings", "设置…", true, None::<&str>)?,
            &MenuItem::with_id(app, "about", "关于瞬览", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            quit,
        ],
    )
}

// A monochrome eye at 2× resolution. macOS supplies the menu bar's light/dark tint.
pub fn tray_icon() -> Image<'static> {
    let mut rgba = vec![0; 36 * 36 * 4];
    for y in 0..36 {
        for x in 0..36 {
            let dx = (x as f64 - 17.5) / 15.0;
            let dy = (y as f64 - 17.5) / 9.0;
            let ellipse = dx * dx + dy * dy;
            let pupil = (x as f64 - 17.5).powi(2) + (y as f64 - 17.5).powi(2);
            if (0.65..=1.0).contains(&ellipse) || pupil <= 20.0 {
                rgba[(y * 36 + x) * 4 + 3] = 255;
            }
        }
    }
    Image::new_owned(rgba, 36, 36)
}
