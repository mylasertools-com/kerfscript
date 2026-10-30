// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// The KerfScript desktop app: the playground in a window, with .kerf files on
// disk. KerfScript itself runs in the page (see desktop/src/desktop.js); this
// side opens, saves and exports files through dialogs, reads the libraries a
// design uses (files.rs), and sends cut files to LightBurn (lightburn.rs).

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod files;
mod lightburn;

use std::path::{absolute, PathBuf};

fn main() {
    // Windows and Linux pass a double-clicked file as an argument
    let pending: Vec<PathBuf> = std::env::args_os()
        .skip(1)
        .map(PathBuf::from)
        .filter(|p| p.is_file())
        .map(|p| absolute(&p).unwrap_or(p))
        .collect();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(files::session(pending))
        .invoke_handler(tauri::generate_handler![
            files::open_pending,
            files::open_design,
            files::save_design,
            files::export_file,
            files::forget_design,
            files::read_library,
            files::legal_file,
            lightburn::lightburn_pair,
            lightburn::lightburn_open
        ])
        .build(tauri::generate_context!())
        .expect("KerfScript could not start")
        .run(|_app, _event| {
            // macOS sends files as an event, also while the app is running
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = _event {
                use tauri::Emitter;
                for path in urls.iter().filter_map(|u| u.to_file_path().ok()) {
                    files::add_pending(_app, path);
                }
                let _ = _app.emit("open-files", ());
            }
        });
}
