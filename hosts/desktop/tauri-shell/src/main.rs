// GENERATED — identity bakes from tauri.conf.json via generate_context!;
// behavior is the shared ph-desktop-shell library. Edit ../app.json, not this.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ph_desktop_shell::run(tauri::generate_context!(), Default::default());
}
