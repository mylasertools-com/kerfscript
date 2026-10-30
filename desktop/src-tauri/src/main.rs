// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// The KerfScript desktop app: the playground in a window, with .kerf files on
// disk. KerfScript itself runs in the page (see desktop/src/desktop.js); this
// side reads and writes files, passes on files the app was opened with, and
// sends cut files to LightBurn (lightburn.rs).

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod lightburn;

use std::path::{absolute, PathBuf};
use std::sync::Mutex;

/// Files to open that the page has not asked for yet.
#[derive(Default)]
struct Opened(Mutex<Vec<String>>);

#[tauri::command]
fn opened_files(state: tauri::State<Opened>) -> Vec<String> {
    std::mem::take(&mut *state.0.lock().unwrap())
}

#[tauri::command]
fn read_text(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("{path}: {e}"))
}

#[tauri::command]
fn write_text(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| format!("{path}: {e}"))
}

#[tauri::command]
fn write_bytes(path: String, contents: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| format!("{path}: {e}"))
}

fn main() {
    // Windows and Linux pass a double-clicked file as an argument
    let files: Vec<String> = std::env::args_os()
        .skip(1)
        .map(PathBuf::from)
        .filter(|p| p.is_file())
        .map(|p| absolute(&p).unwrap_or(p).to_string_lossy().into_owned())
        .collect();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Opened(Mutex::new(files)))
        .invoke_handler(tauri::generate_handler![
            opened_files,
            read_text,
            write_text,
            write_bytes,
            lightburn::lightburn_pair,
            lightburn::lightburn_open
        ])
        .build(tauri::generate_context!())
        .expect("KerfScript could not start")
        .run(|_app, _event| {
            // macOS sends files as an event, also while the app is running
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = _event {
                use tauri::{Emitter, Manager};
                let paths = urls
                    .iter()
                    .filter_map(|u| u.to_file_path().ok())
                    .map(|p| p.to_string_lossy().into_owned());
                _app.state::<Opened>().0.lock().unwrap().extend(paths);
                let _ = _app.emit("open-files", ());
            }
        });
}
