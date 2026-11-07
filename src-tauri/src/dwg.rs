use super::{authorized, PreviewState};
use std::{
    collections::HashMap,
    io::{Read, Write},
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex, OnceLock},
    time::Duration,
};
use tauri::State;
const OUTPUT_LIMIT: usize = 16 * 1024 * 1024;
type Jobs = Mutex<HashMap<String, Arc<Mutex<Child>>>>;
fn jobs() -> &'static Jobs {
    static JOBS: OnceLock<Jobs> = OnceLock::new();
    JOBS.get_or_init(|| Mutex::new(HashMap::new()))
}

// A separate process bounds lifetime: closing a preview kills native parsing too.
pub fn worker_main() -> bool {
    let mut args = std::env::args_os().skip(1);
    if args.next().as_deref() != Some(std::ffi::OsStr::new("--spacepreview-dwg")) {
        return false;
    }
    let result = (|| -> Result<(), Box<dyn std::error::Error>> {
        let path = args.next().ok_or("Missing DWG file")?;
        if std::fs::metadata(&path)?.len() > 32 * 1024 * 1024 {
            return Err("DWG exceeds 32 MiB".into());
        }
        let options = acadrust::DwgReadOptions::default()
            .with_max_decompressed_bytes(128 * 1024 * 1024)
            .with_mesh_limits(100_000, 300_000);
        let doc = acadrust::DwgReader::from_file_with_options(path, options)?.read()?;
        struct LimitedOutput {
            written: usize,
        }
        impl Write for LimitedOutput {
            fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
                if self.written + bytes.len() > OUTPUT_LIMIT {
                    return Err(std::io::Error::other("DWG preview output exceeds 16 MiB"));
                }
                std::io::stdout().lock().write_all(bytes)?;
                self.written += bytes.len();
                Ok(bytes.len())
            }
            fn flush(&mut self) -> std::io::Result<()> {
                std::io::stdout().lock().flush()
            }
        }
        acadrust::DxfWriter::new(&doc).write_to_writer(LimitedOutput { written: 0 })?;
        Ok(())
    })();
    if let Err(error) = result {
        eprintln!("DWG preview: {error}");
        std::process::exit(1);
    }
    true
}
#[tauri::command]
pub fn cancel_dwg(job: String) {
    let child = { jobs().lock().unwrap().remove(&job) };
    if let Some(child) = child {
        let _ = child.lock().unwrap().kill();
    }
}
#[tauri::command]
pub async fn read_dwg(
    path: String,
    job: String,
    state: State<'_, PreviewState>,
) -> Result<tauri::ipc::Response, String> {
    let source = authorized(&path, &state)?;
    if std::fs::metadata(&source).map_err(|e| e.to_string())?.len() > 32 * 1024 * 1024 {
        return Err("DWG 图纸超过 32 MiB 解析上限。".into());
    }
    if job.len() > 100 {
        return Err("无效的图纸任务".into());
    }
    let mut command = Command::new(std::env::current_exe().map_err(|e| e.to_string())?);
    command
        .arg("--spacepreview-dwg")
        .arg(source)
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = command.spawn().map_err(|e| e.to_string())?;
    let stdout = child.stdout.take().ok_or("无法读取图纸输出")?;
    let child = Arc::new(Mutex::new(child));
    jobs().lock().unwrap().insert(job.clone(), child.clone());
    tauri::async_runtime::spawn_blocking(move || {
        let (done, finished) = std::sync::mpsc::channel();
        let timeout_child = child.clone();
        let timer = std::thread::spawn(move || {
            if finished.recv_timeout(Duration::from_secs(30)).is_err() {
                let _ = timeout_child.lock().unwrap().kill();
            }
        });
        let mut bytes = Vec::new();
        let read = stdout.take(OUTPUT_LIMIT as u64 + 1).read_to_end(&mut bytes);
        let _ = done.send(());
        let _ = timer.join();
        let mut process = child.lock().unwrap();
        if read.is_err() || bytes.len() > OUTPUT_LIMIT {
            let _ = process.kill();
        }
        let status = process.wait().map_err(|e| e.to_string());
        jobs().lock().unwrap().remove(&job);
        read.map_err(|e| e.to_string())?;
        if !status?.success() || bytes.len() > OUTPUT_LIMIT {
            return Err("DWG 解析失败、图纸过于复杂或任务已取消；请尝试导出 DXF。".into());
        }
        Ok(tauri::ipc::Response::new(bytes))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[ignore = "child process used by cancellation test"]
    fn sleeping_child() {
        std::thread::sleep(Duration::from_secs(10));
    }
    #[test]
    fn cancelling_preview_kills_its_parser_process() {
        let child = Command::new(std::env::current_exe().unwrap())
            .args(["--ignored", "--exact", "dwg::tests::sleeping_child"])
            .stdout(Stdio::null())
            .spawn()
            .unwrap();
        let child = Arc::new(Mutex::new(child));
        jobs()
            .lock()
            .unwrap()
            .insert("cancel-test".into(), child.clone());
        cancel_dwg("cancel-test".into());
        assert!(!child.lock().unwrap().wait().unwrap().success());
        assert!(!jobs().lock().unwrap().contains_key("cancel-test"));
    }
}
