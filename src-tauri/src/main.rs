#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if space_preview_lib::dwg_worker_main() {
        return;
    }
    space_preview_lib::run();
}
