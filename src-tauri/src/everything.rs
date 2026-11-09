//! Everything result selection without modifying the clipboard or search settings.
use std::path::{Path, PathBuf};
use windows::{
    core::Interface,
    Win32::{
        Foundation::{E_NOTIMPL, HWND},
        System::Com::{CoCreateInstance, CLSCTX_INPROC_SERVER},
        UI::{
            Accessibility::{
                CUIAutomation8, IUIAutomation, IUIAutomation2, IUIAutomationElement,
                IUIAutomationElementArray, IUIAutomationScrollItemPattern,
                IUIAutomationSelectionItemPattern, IUIAutomationSelectionPattern,
                TreeScope_Children, UIA_ListItemControlTypeId, UIA_ScrollItemPatternId,
                UIA_SelectionItemPatternId, UIA_SelectionPatternId,
            },
            WindowsAndMessaging::{
                GetAncestor, GetDlgItem, GetForegroundWindow, IsWindow, SetForegroundWindow,
                GA_ROOT,
            },
        },
    },
};

const RESULT_LIST_ID: i32 = 10020;

pub fn is_window_class(class: &str) -> bool {
    class == "EVERYTHING"
        || class
            .strip_prefix("EVERYTHING_(")
            .is_some_and(|instance| instance.ends_with(')'))
}

pub unsafe fn result_list(window: HWND) -> windows::core::Result<HWND> {
    GetDlgItem(Some(window), RESULT_LIST_ID)
}

pub unsafe fn has_list_focus(window: HWND, focus: HWND) -> bool {
    // A rename editor is a child of the list. Only the list itself qualifies.
    !focus.0.is_null() && result_list(window).is_ok_and(|list| list == focus)
}

unsafe fn automation() -> windows::core::Result<IUIAutomation> {
    let client: IUIAutomation = CoCreateInstance(&CUIAutomation8, None, CLSCTX_INPROC_SERVER)?;
    let settings: IUIAutomation2 = client.cast()?;
    settings.SetConnectionTimeout(1000)?;
    settings.SetTransactionTimeout(1000)?;
    Ok(client)
}

unsafe fn selection(
    client: &IUIAutomation,
    list: HWND,
) -> windows::core::Result<IUIAutomationElementArray> {
    let element = client.ElementFromHandle(list)?;
    let pattern: IUIAutomationSelectionPattern =
        element.GetCurrentPatternAs(UIA_SelectionPatternId)?;
    pattern.GetCurrentSelection()
}

fn existing_path(text: &str) -> Option<PathBuf> {
    let path = PathBuf::from(text.trim().trim_matches('"'));
    (path.is_absolute() && (path.is_file() || path.is_dir())).then_some(path)
}

fn row_path(name: &str, cells: &[String]) -> Option<PathBuf> {
    if let Some(path) = existing_path(name) {
        return Some(path);
    }
    // UIA exposes Name and Path cells in both 1.4 and 1.5. Resolve by values,
    // so translated headers and reordered columns do not affect selection.
    cells.iter().find_map(|cell| {
        let folder = existing_path(cell)?;
        let path = folder.join(name);
        (path.is_file() || path.is_dir()).then_some(path)
    })
}

unsafe fn accessible_path(
    client: &IUIAutomation,
    row: &IUIAutomationElement,
) -> windows::core::Result<Option<PathBuf>> {
    let name = row.CurrentName()?.to_string();
    if let Some(path) = existing_path(&name) {
        return Ok(Some(path));
    }
    let cells = row.FindAll(TreeScope_Children, &client.CreateTrueCondition()?)?;
    let mut values = Vec::new();
    for index in 0..cells.Length()?.min(64) {
        values.push(cells.GetElement(index)?.CurrentName()?.to_string());
    }
    Ok(row_path(&name, &values))
}

pub unsafe fn selected_paths(window: HWND) -> windows::core::Result<(Vec<String>, HWND)> {
    let list = result_list(window)?;
    let client = automation()?;
    let rows = selection(&client, list)?;
    let count = rows.Length()?;
    let mut paths = Vec::new();
    for index in 0..count.min(100) {
        let path = accessible_path(&client, &rows.GetElement(index)?)?;
        if let Some(path) = path {
            paths.push(path.to_string_lossy().into_owned());
        }
    }
    if count > 0 && paths.is_empty() {
        return Err(windows::core::Error::new(
            E_NOTIMPL,
            "无法读取 Everything 所选文件路径，请确认路径列可见且文件仍然存在。",
        ));
    }
    Ok((paths, list))
}

pub unsafe fn navigate(
    list: HWND,
    current: &Path,
    direction: i32,
    valid: impl Fn() -> bool,
) -> windows::core::Result<Option<String>> {
    if !valid() || !IsWindow(Some(list)).as_bool() {
        return Ok(None);
    }
    let client = automation()?;
    let rows = selection(&client, list)?;
    if rows.Length()? != 1 {
        return Ok(None);
    }
    let row = rows.GetElement(0)?;
    if accessible_path(&client, &row)?
        .and_then(|p| p.canonicalize().ok())
        .as_deref()
        != Some(current)
    {
        return Ok(None);
    }
    let walker = client.ControlViewWalker()?;
    let adjacent = if direction < 0 {
        walker.GetPreviousSiblingElement(&row)
    } else {
        walker.GetNextSiblingElement(&row)
    };
    let Ok(next) = adjacent else {
        return Ok(None);
    };
    if next.CurrentControlType()? != UIA_ListItemControlTypeId {
        return Ok(None);
    }
    let Some(path) = accessible_path(&client, &next)? else {
        return Ok(None);
    };
    if !valid() {
        return Ok(None);
    }
    let pattern: IUIAutomationSelectionItemPattern =
        next.GetCurrentPatternAs(UIA_SelectionItemPatternId)?;
    let preview = GetForegroundWindow();
    pattern.Select()?;
    if let Ok(scroll) =
        next.GetCurrentPatternAs::<IUIAutomationScrollItemPattern>(UIA_ScrollItemPatternId)
    {
        let _ = scroll.ScrollIntoView();
    }
    // The legacy list-view accessibility provider can activate its owner while
    // selecting. Return focus only from that source, never from another app.
    if GetForegroundWindow() == GetAncestor(list, GA_ROOT) {
        let _ = SetForegroundWindow(preview);
    }
    Ok(Some(path.to_string_lossy().into_owned()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_only_everything_windows_and_named_instances() {
        for class in ["EVERYTHING", "EVERYTHING_(1.5a)", "EVERYTHING_(Work)"] {
            assert!(is_window_class(class));
        }
        for class in [
            "Edit",
            "CabinetWClass",
            "EVERYTHING_RESULT_LIST_FOCUS",
            "EVERYTHING_ELSE",
            "EVERYTHING_(Work",
        ] {
            assert!(!is_window_class(class));
        }
    }

    #[test]
    fn resolves_unicode_paths_independently_of_column_order() {
        let folder =
            std::env::temp_dir().join(format!("spacepreview-everything-{}", std::process::id()));
        std::fs::create_dir_all(&folder).unwrap();
        let file = folder.join("中文 file.txt");
        std::fs::write(&file, "test").unwrap();
        let cells = vec![
            "1 KB".into(),
            folder.to_string_lossy().into_owned(),
            "中文 file.txt".into(),
        ];
        assert_eq!(row_path("中文 file.txt", &cells), Some(file.clone()));
        assert_eq!(row_path(&file.to_string_lossy(), &[]), Some(file.clone()));
        assert_eq!(row_path("missing.txt", &cells), None);
        assert_eq!(row_path("中文 file.txt", &["relative".into()]), None);
        std::fs::remove_file(file).unwrap();
        std::fs::remove_dir(folder).unwrap();
    }

    #[test]
    #[ignore = "requires an Everything test window with a selected fixture"]
    fn reads_real_everything_selection() {
        unsafe {
            use windows::Win32::System::Com::{
                CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED,
            };
            CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok().unwrap();
            let handle: usize = std::env::var("SPACEPREVIEW_TEST_EVERYTHING_HWND")
                .unwrap()
                .parse()
                .unwrap();
            let (paths, list) = selected_paths(HWND(handle as *mut _)).unwrap();
            let mut class = [0; 128];
            let length = windows::Win32::UI::WindowsAndMessaging::GetClassNameW(
                HWND(handle as *mut _),
                &mut class,
            );
            let class = String::from_utf16_lossy(&class[..length as usize]);
            assert!(
                is_window_class(&class),
                "Unsupported Everything class: {class}"
            );
            println!("Everything list={list:?} selection={paths:?}");
            assert_eq!(paths.len(), 1);
            assert_eq!(
                std::fs::canonicalize(&paths[0]).unwrap(),
                std::fs::canonicalize(std::env::var("SPACEPREVIEW_TEST_EVERYTHING_PATH").unwrap())
                    .unwrap()
            );
            assert!(has_list_focus(HWND(handle as *mut _), list));
            assert!(!has_list_focus(HWND(handle as *mut _), HWND::default()));
            let search_panel = GetDlgItem(Some(HWND(handle as *mut _)), 10006).unwrap();
            let search = GetDlgItem(Some(search_panel), 10007).unwrap();
            assert!(!has_list_focus(HWND(handle as *mut _), search));
            CoUninitialize();
        }
    }
}
