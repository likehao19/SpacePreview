//! Receive the local preview protocol used by PecoFence and other QuickLook clients.
use std::io::{BufRead, BufReader, Read};
use std::os::windows::io::FromRawHandle;
use tauri::{AppHandle, Emitter, Manager};
use windows::{
    core::{PCWSTR, PWSTR},
    Win32::{
        Foundation::{
            CloseHandle, LocalFree, ERROR_PIPE_CONNECTED, HANDLE, HLOCAL, INVALID_HANDLE_VALUE,
        },
        Security::{
            Authorization::ConvertSidToStringSidW, GetTokenInformation, TokenUser, TOKEN_QUERY,
            TOKEN_USER,
        },
        Storage::FileSystem::{FILE_FLAG_FIRST_PIPE_INSTANCE, PIPE_ACCESS_INBOUND},
        System::{
            Pipes::{
                ConnectNamedPipe, CreateNamedPipeW, DisconnectNamedPipe,
                PIPE_REJECT_REMOTE_CLIENTS, PIPE_TYPE_BYTE,
            },
            Threading::{GetCurrentProcess, OpenProcessToken},
        },
        UI::WindowsAndMessaging::GetForegroundWindow,
    },
};

fn pipe_name() -> windows::core::Result<Vec<u16>> {
    unsafe {
        let mut token = HANDLE::default();
        OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token)?;
        let result = (|| {
            let mut length = 0;
            let _ = GetTokenInformation(token, TokenUser, None, 0, &mut length);
            // TOKEN_USER contains pointers and must be pointer-aligned.
            let mut buffer = vec![0usize; (length as usize).div_ceil(std::mem::size_of::<usize>())];
            GetTokenInformation(
                token,
                TokenUser,
                Some(buffer.as_mut_ptr().cast()),
                length,
                &mut length,
            )?;
            let user = &*(buffer.as_ptr() as *const TOKEN_USER);
            let mut sid = PWSTR::null();
            ConvertSidToStringSidW(user.User.Sid, &mut sid)?;
            let value = sid.to_string();
            let _ = LocalFree(Some(HLOCAL(sid.0.cast())));
            Ok(format!(r"\\.\pipe\QuickLook.App.Pipe.{}", value?)
                .encode_utf16()
                .chain(Some(0))
                .collect())
        })();
        let _ = CloseHandle(token);
        result
    }
}

#[derive(Debug, PartialEq)]
struct PreviewMessage {
    action: &'static str,
    path: String,
}

fn parse_message(line: &str) -> Option<PreviewMessage> {
    let (command, path) = line.trim_end_matches(['\r', '\n']).split_once('|')?;
    let action = match command.strip_prefix("QuickLook.App.PipeMessages.")? {
        "Toggle" => "toggle",
        "Switch" => "switch",
        "Close" => "close",
        _ => return None,
    };
    if path.contains(['\0', '\r', '\n'])
        || (action != "close" && !std::path::Path::new(path).is_absolute())
    {
        return None;
    }
    Some(PreviewMessage {
        action,
        path: path.into(),
    })
}

pub fn start(app: AppHandle) {
    std::thread::spawn(move || unsafe {
        let Ok(name) = pipe_name() else { return };
        // First-instance ownership leaves an already running QuickLook server in control.
        // The default pipe ACL permits the owner, administrators and LocalSystem.
        let pipe = CreateNamedPipeW(
            PCWSTR(name.as_ptr()),
            PIPE_ACCESS_INBOUND | FILE_FLAG_FIRST_PIPE_INSTANCE,
            PIPE_TYPE_BYTE | PIPE_REJECT_REMOTE_CLIENTS,
            1,
            0,
            65536,
            0,
            None,
        );
        if pipe == INVALID_HANDLE_VALUE {
            crate::diagnostics::record(
                "QuickLook compatibility pipe unavailable (another server may own it)",
            );
            return;
        }
        let file = std::fs::File::from_raw_handle(pipe.0);
        crate::diagnostics::record("QuickLook compatibility pipe ready");
        loop {
            if let Err(error) = ConnectNamedPipe(pipe, None) {
                if error.code() != ERROR_PIPE_CONNECTED.to_hresult() {
                    break;
                }
            }
            let mut bytes = Vec::new();
            let read = BufReader::new((&file).take(65537)).read_until(b'\n', &mut bytes);
            let message = read
                .ok()
                .filter(|_| bytes.len() <= 65536)
                .and_then(|_| std::str::from_utf8(&bytes).ok())
                .and_then(parse_message);
            let _ = DisconnectNamedPipe(pipe);
            if let Some(message) = message {
                let handle = GetForegroundWindow().0 as usize;
                let path = if message.action == "close" {
                    String::new()
                } else {
                    let Ok(path) = std::fs::canonicalize(&message.path) else {
                        continue;
                    };
                    path.to_string_lossy().into_owned()
                };
                let dispatch = app.clone();
                let _ = app.run_on_main_thread(move || {
                    if !crate::windows_agent::is_enabled() {
                        return;
                    }
                    let Some(window) = dispatch.get_webview_window("main") else {
                        return;
                    };
                    let visible = window.is_visible().unwrap_or(false);
                    if message.action == "switch" && !visible {
                        return;
                    }
                    if message.action == "toggle" {
                        if GetForegroundWindow().0 as usize != handle {
                            return;
                        }
                        crate::windows_agent::external_source(handle);
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                    let _ = window.emit(
                        "external-preview",
                        serde_json::json!({"action":message.action,"path":path,"visible":visible}),
                    );
                    crate::diagnostics::record(format!("external preview {}", message.action));
                });
            }
        }
        // File owns and closes the pipe handle when this worker exits.
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn accepts_unicode_local_paths_and_all_supported_actions() {
        let message =
            parse_message("QuickLook.App.PipeMessages.Toggle|D:\\文档\\示例.xlsx\r\n").unwrap();
        assert_eq!(message.action, "toggle");
        assert_eq!(message.path, "D:\\文档\\示例.xlsx");
        assert_eq!(
            parse_message("QuickLook.App.PipeMessages.Switch|D:\\a.txt\n")
                .unwrap()
                .action,
            "switch"
        );
        assert_eq!(
            parse_message("QuickLook.App.PipeMessages.Close|\n")
                .unwrap()
                .action,
            "close"
        );
    }
    #[test]
    fn rejects_unknown_commands_relative_paths_and_multiple_lines() {
        for line in [
            "Toggle|D:\\a.txt",
            "QuickLook.App.PipeMessages.Run|D:\\a.exe",
            "QuickLook.App.PipeMessages.Toggle|a.txt",
            "QuickLook.App.PipeMessages.Toggle|D:\\a\nb",
        ] {
            assert!(parse_message(line).is_none());
        }
    }
}
