// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

//! The files the page can reach. It never names a path: designs come from the
//! open and save dialogs or from the app's start (a double-clicked file),
//! exports go where the user picks in a save dialog, and libraries are read
//! from the open design's folder and the folders below it. Every read is of a
//! regular file and has a size limit.

use serde::Serialize;
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::{DialogExt, FilePath};

/// Largest design or library file, in bytes: the playground's 1,000,000
/// characters at up to 3 bytes each in UTF-8
pub const MAX_FILE: u64 = 3_000_000;
/// Licence files shipped with the app, readable from the About window
const LEGAL: [&str; 5] = [
    "LICENSE",
    "COMMERCIAL-LICENSE.md",
    "THIRD-PARTY-NOTICES.md",
    "THIRD-PARTY-LICENSES.md",
    "OFL.txt",
];

#[derive(Default)]
pub struct Session {
    /// The open design
    design: Option<PathBuf>,
    /// Files the system asked the app to open, not opened yet
    pending: Vec<PathBuf>,
}

pub type State = Mutex<Session>;

pub fn session(pending: Vec<PathBuf>) -> State {
    Mutex::new(Session {
        design: None,
        pending,
    })
}

/// Adds a file the system asked the app to open (macOS sends these as events).
#[cfg(target_os = "macos")]
pub fn add_pending(app: &AppHandle, path: PathBuf) {
    app.state::<State>().lock().unwrap().pending.push(path);
}

#[derive(Serialize)]
pub struct Design {
    /// File name without .kerf, for the title and export names
    name: String,
    text: String,
}

fn name_of(path: &Path) -> String {
    path.file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default()
}

fn too_large(shown: &std::path::Display, max: u64) -> String {
    format!("{shown} is larger than {} MB", max as f64 / 1e6)
}

/// Reads a regular file of at most `max` bytes as UTF-8 text.
pub fn read_bounded(path: &Path, max: u64) -> Result<String, String> {
    let shown = path.display();
    let meta = std::fs::metadata(path).map_err(|e| format!("{shown}: {e}"))?;
    if !meta.is_file() {
        return Err(format!("{shown} is not a file"));
    }
    if meta.len() > max {
        return Err(too_large(&shown, max));
    }
    let mut bytes = Vec::new();
    std::fs::File::open(path)
        .and_then(|f| f.take(max + 1).read_to_end(&mut bytes))
        .map_err(|e| format!("{shown}: {e}"))?;
    if bytes.len() as u64 > max {
        return Err(too_large(&shown, max));
    }
    String::from_utf8(bytes).map_err(|_| format!("{shown} is not UTF-8 text"))
}

/// The file a `use <path>` or `include <path>` names, in the design's folder or
/// below it, with or without .kerf.
pub fn library_path(design: &Path, path: &str) -> Result<PathBuf, String> {
    let wanted = Path::new(path);
    if wanted
        .components()
        .any(|c| !matches!(c, Component::Normal(_) | Component::CurDir))
    {
        return Err(format!(
            "<{path}>: libraries are read from the design's folder and the folders below it"
        ));
    }
    let root = design
        .parent()
        .ok_or("The design has no folder")?
        .canonicalize()
        .map_err(|e| e.to_string())?;
    for candidate in [path.to_string(), format!("{path}.kerf")] {
        let full = root.join(&candidate);
        if !full.is_file() {
            continue;
        }
        // A link may point outside the folder
        let real = full.canonicalize().map_err(|e| e.to_string())?;
        if !real.starts_with(&root) {
            return Err(format!("<{path}> is outside the design's folder"));
        }
        return Ok(real);
    }
    Err(format!("<{path}> was not found next to the design"))
}

fn picked(path: Option<FilePath>) -> Option<PathBuf> {
    path.and_then(|p| p.into_path().ok())
}

fn open(app: &AppHandle, path: PathBuf) -> Result<Design, String> {
    let text = read_bounded(&path, MAX_FILE)?;
    let name = name_of(&path);
    app.state::<State>().lock().unwrap().design = Some(path);
    Ok(Design { name, text })
}

fn design_dir(app: &AppHandle) -> Option<PathBuf> {
    let state = app.state::<State>();
    let design = state.lock().unwrap().design.clone();
    design.and_then(|d| d.parent().map(Path::to_path_buf))
}

/// Runs a function that shows a dialog off the main thread.
async fn blocking<T: Send + 'static>(
    app: AppHandle,
    f: impl FnOnce(AppHandle) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(move || f(app))
        .await
        .map_err(|e| e.to_string())?
}

/// Opens the next file the system asked for, if any.
#[tauri::command]
pub fn open_pending(app: AppHandle) -> Result<Option<Design>, String> {
    let next = {
        let state = app.state::<State>();
        let mut s = state.lock().unwrap();
        (!s.pending.is_empty()).then(|| s.pending.remove(0))
    };
    next.map(|path| open(&app, path)).transpose()
}

/// Shows the open dialog and opens the chosen design.
#[tauri::command]
pub async fn open_design(app: AppHandle) -> Result<Option<Design>, String> {
    blocking(app, |app| {
        let mut dialog = app.dialog().file().add_filter("KerfScript", &["kerf"]);
        if let Some(dir) = design_dir(&app) {
            dialog = dialog.set_directory(dir);
        }
        picked(dialog.blocking_pick_file())
            .map(|path| open(&app, path))
            .transpose()
    })
    .await
}

/// Saves the design to its file, or with a save dialog for a new design or
/// Save as. Returns the file's name, or nothing when the dialog was cancelled.
#[tauri::command]
pub async fn save_design(
    app: AppHandle,
    text: String,
    save_as: bool,
    name: String,
) -> Result<Option<String>, String> {
    blocking(app, move |app| {
        let current = app.state::<State>().lock().unwrap().design.clone();
        let path = match current {
            Some(path) if !save_as => path,
            _ => {
                let mut dialog = app
                    .dialog()
                    .file()
                    .add_filter("KerfScript", &["kerf"])
                    .set_file_name(format!("{name}.kerf"));
                if let Some(dir) = design_dir(&app) {
                    dialog = dialog.set_directory(dir);
                }
                match picked(dialog.blocking_save_file()) {
                    Some(p)
                        if p.extension()
                            .is_some_and(|e| e.eq_ignore_ascii_case("kerf")) =>
                    {
                        p
                    }
                    Some(p) => p.with_extension("kerf"),
                    None => return Ok(None),
                }
            }
        };
        std::fs::write(&path, text).map_err(|e| format!("{}: {e}", path.display()))?;
        let saved = name_of(&path);
        app.state::<State>().lock().unwrap().design = Some(path);
        Ok(Some(saved))
    })
    .await
}

/// Saves an export (SVG, DXF or ZIP) where the user picks, starting in the
/// design's folder. Returns false when the dialog was cancelled.
#[tauri::command]
pub async fn export_file(
    app: AppHandle,
    name: String,
    text: Option<String>,
    bytes: Option<Vec<u8>>,
) -> Result<bool, String> {
    blocking(app, move |app| {
        let ext = Path::new(&name)
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        let mut dialog = app.dialog().file().set_file_name(&name);
        if !ext.is_empty() {
            dialog = dialog.add_filter(ext.to_uppercase(), &[ext.as_str()]);
        }
        if let Some(dir) = design_dir(&app) {
            dialog = dialog.set_directory(dir);
        }
        let Some(path) = picked(dialog.blocking_save_file()) else {
            return Ok(false);
        };
        let data = bytes.unwrap_or_else(|| text.unwrap_or_default().into_bytes());
        std::fs::write(&path, data).map_err(|e| format!("{}: {e}", path.display()))?;
        Ok(true)
    })
    .await
}

/// The design is no longer a file on disk (an example was loaded instead).
#[tauri::command]
pub fn forget_design(app: AppHandle) {
    app.state::<State>().lock().unwrap().design = None;
}

/// Reads a library the open design uses.
#[tauri::command]
pub fn read_library(app: AppHandle, path: String) -> Result<String, String> {
    let design = app.state::<State>().lock().unwrap().design.clone();
    let design = design.ok_or("Save the design to use libraries next to it")?;
    read_bounded(&library_path(&design, &path)?, MAX_FILE)
}

/// One of the licence files shipped with the app.
#[tauri::command]
pub fn legal_file(app: AppHandle, name: String) -> Result<String, String> {
    if !LEGAL.contains(&name.as_str()) {
        return Err(format!("{name} is not one of the app's licence files"));
    }
    let dir = app.path().resource_dir().map_err(|e| e.to_string())?;
    read_bounded(&dir.join(name), 4 << 20)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn folder(name: &str) -> PathBuf {
        let dir = std::env::temp_dir()
            .join(format!("kerfscript-files-{}", std::process::id()))
            .join(name);
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("lib")).unwrap();
        std::fs::write(dir.join("box.kerf"), "use <lib/tab>\n").unwrap();
        std::fs::write(dir.join("lib/tab.kerf"), "module tab() rect(5);\n").unwrap();
        dir
    }

    #[test]
    fn libraries_are_read_from_the_design_folder_and_below() {
        let dir = folder("below");
        let design = dir.join("box.kerf");
        let found = library_path(&design, "lib/tab").unwrap();
        assert!(found.ends_with(Path::new("lib").join("tab.kerf")));
        assert!(library_path(&design, "lib/tab.kerf").is_ok());
        assert!(library_path(&design, "lib/none").is_err());
    }

    #[test]
    fn libraries_outside_the_design_folder_are_refused() {
        let dir = folder("outside");
        std::fs::write(dir.parent().unwrap().join("secret.kerf"), "x").unwrap();
        let design = dir.join("box.kerf");
        for path in [
            "../secret",
            "lib/../../secret",
            "/etc/passwd",
            "C:/Windows/win.ini",
        ] {
            assert!(library_path(&design, path).is_err(), "{path}");
        }
    }

    #[test]
    fn reads_are_bounded_and_only_of_regular_files() {
        let dir = folder("bounded");
        let big = dir.join("big.kerf");
        std::fs::write(&big, vec![b'a'; 2048]).unwrap();
        assert!(read_bounded(&big, 1024).unwrap_err().contains("larger"));
        assert_eq!(read_bounded(&big, 4096).unwrap().len(), 2048);
        assert!(read_bounded(&dir.join("lib"), 4096)
            .unwrap_err()
            .contains("not a file"));
        let binary = dir.join("bin.kerf");
        std::fs::write(&binary, [0xff, 0xfe, 0x00]).unwrap();
        assert!(read_bounded(&binary, 4096).unwrap_err().contains("UTF-8"));
    }
}
