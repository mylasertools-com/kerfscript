// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

//! Opens cut files in LightBurn through its REST API (LightBurn 2.2 and
//! later), as documented at https://github.com/LightBurnSoftware/LightBurn-REST.
//!
//! The first time, KerfScript pairs with LightBurn and asks only for the
//! `upload` capability: LightBurn shows a dialog, and once the user allows it
//! we keep the shared secret in the app's config folder. Each request is
//! signed with a token made from the secret and the current minute. The API
//! cannot start a job; the user reviews the file in LightBurn and runs it there.

use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

// LightBurn's fixed API port. The API only listens on this computer unless the
// user opens it to the network, and pairing only works locally.
const BASE: &str = "http://127.0.0.1:19520";

/// Errors the page shows its own message for; anything else is shown as is.
const NOT_RUNNING: &str = "not-running";
const NEEDS_PAIRING: &str = "needs-pairing";
const DECLINED: &str = "declined";

fn secret_file(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("lightburn-secret"))
}

/// hex(HMAC-SHA256(secret, floor(unix time / 60)))
fn token(secret: &str) -> String {
    let minute = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() / 60)
        .unwrap_or(0);
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).expect("HMAC takes any key");
    mac.update(minute.to_string().as_bytes());
    mac.finalize()
        .into_bytes()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

fn agent() -> ureq::Agent {
    // Pairing waits for the user to answer LightBurn's dialog, which gives up
    // after 30 seconds. LightBurn is on this computer: the system's proxy
    // would not reach it, and a redirect would send the file elsewhere.
    ureq::Agent::config_builder()
        .proxy(None)
        .max_redirects(0)
        .http_status_as_error(false)
        .timeout_connect(Some(Duration::from_secs(3)))
        .timeout_global(Some(Duration::from_secs(45)))
        .build()
        .into()
}

fn transport(e: ureq::Error) -> String {
    match e {
        ureq::Error::ConnectionFailed => NOT_RUNNING.into(),
        ureq::Error::Io(io) if io.kind() == std::io::ErrorKind::ConnectionRefused => {
            NOT_RUNNING.into()
        }
        e => format!("Could not reach LightBurn: {e}"),
    }
}

/// Header values must be plain ASCII; LightBurn only needs the extension.
fn ascii_name(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_ascii_graphic() || c == ' ' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

fn pair(base: &str, file: &Path) -> Result<(), String> {
    let mut response = agent()
        .post(format!("{base}/api/connect"))
        .header("Content-Type", "application/json")
        .send(r#"{"application_name":"KerfScript","capabilities":["upload"]}"#)
        .map_err(transport)?;
    match response.status().as_u16() {
        200 => {
            let body: serde_json::Value = serde_json::from_str(
                &response
                    .body_mut()
                    .read_to_string()
                    .map_err(|e| e.to_string())?,
            )
            .map_err(|e| e.to_string())?;
            let secret = body["secret"]
                .as_str()
                .ok_or("LightBurn did not send a secret")?;
            write_private(file, secret).map_err(|e| e.to_string())
        }
        403 => Err(DECLINED.into()),
        code => Err(format!("LightBurn refused pairing ({code})")),
    }
}

/// Writes the secret so only this user can read it (Windows keeps each
/// user's app data private already).
fn write_private(file: &Path, secret: &str) -> std::io::Result<()> {
    #[cfg(unix)]
    {
        use std::io::Write;
        use std::os::unix::fs::{DirBuilderExt, OpenOptionsExt};
        if let Some(dir) = file.parent() {
            std::fs::DirBuilder::new()
                .recursive(true)
                .mode(0o700)
                .create(dir)?;
            make_private(dir, 0o700)?;
        }
        let mut f = std::fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(file)?;
        make_private(file, 0o600)?;
        f.write_all(secret.as_bytes())
    }
    #[cfg(not(unix))]
    {
        if let Some(dir) = file.parent() {
            std::fs::create_dir_all(dir)?;
        }
        std::fs::write(file, secret)
    }
}

/// Takes away other users' access to a file or folder made earlier.
#[cfg(unix)]
fn make_private(path: &Path, mode: u32) -> std::io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    let current = std::fs::metadata(path)?.permissions().mode() & 0o777;
    if current & 0o077 != 0 {
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(mode))?;
    }
    Ok(())
}

fn open(base: &str, file: &Path, name: &str, contents: &str) -> Result<(), String> {
    #[cfg(unix)]
    {
        let _ = make_private(file, 0o600);
        if let Some(dir) = file.parent() {
            let _ = make_private(dir, 0o700);
        }
    }
    let secret = match std::fs::read_to_string(file) {
        Ok(s) if !s.trim().is_empty() => s.trim().to_string(),
        _ => return Err(NEEDS_PAIRING.into()),
    };
    let mut response = agent()
        .post(format!("{base}/api/file/open"))
        .header("Authorization", format!("Bearer {}", token(&secret)))
        .header("Content-Type", "application/octet-stream")
        .header("X-Filename", ascii_name(name))
        .send(contents.as_bytes())
        .map_err(transport)?;
    match response.status().as_u16() {
        200 | 202 => Ok(()),
        // Revoked, expired, or paired with another copy of LightBurn: pair again
        401 => {
            let _ = std::fs::remove_file(file);
            Err(NEEDS_PAIRING.into())
        }
        code => Err(format!(
            "LightBurn could not open the file ({code}): {}",
            response.body_mut().read_to_string().unwrap_or_default()
        )),
    }
}

/// Asks LightBurn to let KerfScript send files. Shows LightBurn's dialog.
#[tauri::command]
pub async fn lightburn_pair(app: AppHandle) -> Result<(), String> {
    let file = secret_file(&app)?;
    tauri::async_runtime::spawn_blocking(move || pair(BASE, &file))
        .await
        .map_err(|e| e.to_string())?
}

/// Opens an SVG or DXF in LightBurn as a new project (File → Open).
#[tauri::command]
pub async fn lightburn_open(app: AppHandle, name: String, contents: String) -> Result<(), String> {
    let file = secret_file(&app)?;
    tauri::async_runtime::spawn_blocking(move || open(BASE, &file, &name, &contents))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{BufRead, BufReader, Read, Write};
    use std::net::TcpListener;
    use std::sync::mpsc;

    fn hex_hmac(key: &[u8], message: &[u8]) -> String {
        let mut mac = Hmac::<Sha256>::new_from_slice(key).unwrap();
        mac.update(message);
        mac.finalize()
            .into_bytes()
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect()
    }

    #[test]
    fn token_is_hmac_sha256_of_the_minute_in_hex() {
        // A published HMAC-SHA256 test vector
        assert_eq!(
            hex_hmac(b"key", b"The quick brown fox jumps over the lazy dog"),
            "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8"
        );
        let minute = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
            / 60;
        let expected = [minute, minute.saturating_sub(1)]
            .map(|m| hex_hmac(b"aB3dE7fG9hJ1kL5m", m.to_string().as_bytes()));
        assert!(expected.contains(&token("aB3dE7fG9hJ1kL5m")));
    }

    #[test]
    fn file_names_become_ascii() {
        assert_eq!(ascii_name("Schild \u{c4}pfel.svg"), "Schild _pfel.svg");
    }

    struct Request {
        line: String,
        headers: Vec<(String, String)>,
        body: Vec<u8>,
    }

    impl Request {
        fn header(&self, name: &str) -> Option<&str> {
            self.headers
                .iter()
                .find(|(k, _)| k.eq_ignore_ascii_case(name))
                .map(|(_, v)| v.as_str())
        }
    }

    /// A stand-in for LightBurn that answers each request with the next reply
    /// and passes on what it received.
    fn fake_lightburn(replies: Vec<(u16, &'static str)>) -> (String, mpsc::Receiver<Request>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let (tx, rx) = mpsc::channel();
        std::thread::spawn(move || {
            for (status, body) in replies {
                let (stream, _) = listener.accept().unwrap();
                let mut reader = BufReader::new(stream);
                let mut line = String::new();
                reader.read_line(&mut line).unwrap();
                let mut headers = Vec::new();
                loop {
                    let mut h = String::new();
                    reader.read_line(&mut h).unwrap();
                    let h = h.trim_end();
                    if h.is_empty() {
                        break;
                    }
                    let (k, v) = h.split_once(':').unwrap();
                    headers.push((k.trim().to_string(), v.trim().to_string()));
                }
                let mut request = Request {
                    line: line.trim_end().to_string(),
                    headers,
                    body: Vec::new(),
                };
                let length: usize = request
                    .header("content-length")
                    .map(|v| v.parse().unwrap())
                    .unwrap_or(0);
                request.body = vec![0; length];
                reader.read_exact(&mut request.body).unwrap();
                let mut stream = reader.into_inner();
                write!(
                    stream,
                    "HTTP/1.1 {status} X\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                )
                .unwrap();
                tx.send(request).unwrap();
            }
        });
        (base, rx)
    }

    fn secret_path(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("kerfscript-lightburn-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join(name);
        let _ = std::fs::remove_file(&file);
        file
    }

    #[test]
    fn pairs_then_opens_a_file_with_a_signed_request() {
        let file = secret_path("pair-open");
        let (base, requests) = fake_lightburn(vec![
            (200, r#"{"status":"ok","secret":"s3cret"}"#),
            (202, r#"{"status":"accepted","filename":"box.svg"}"#),
        ]);
        assert_eq!(
            open(&base, &file, "box.svg", "<svg/>"),
            Err(NEEDS_PAIRING.into())
        );
        pair(&base, &file).unwrap();
        let connect = requests.recv().unwrap();
        assert_eq!(connect.line, "POST /api/connect HTTP/1.1");
        let body: serde_json::Value = serde_json::from_slice(&connect.body).unwrap();
        assert_eq!(body["application_name"], "KerfScript");
        assert_eq!(body["capabilities"], serde_json::json!(["upload"]));
        assert_eq!(std::fs::read_to_string(&file).unwrap(), "s3cret");

        open(&base, &file, "box.svg", "<svg/>").unwrap();
        let upload = requests.recv().unwrap();
        assert_eq!(upload.line, "POST /api/file/open HTTP/1.1");
        assert_eq!(upload.header("x-filename"), Some("box.svg"));
        assert_eq!(
            upload.header("content-type"),
            Some("application/octet-stream")
        );
        assert_eq!(upload.body, b"<svg/>");
        let bearer = upload.header("authorization").unwrap();
        assert_eq!(bearer, format!("Bearer {}", token("s3cret")));
    }

    #[cfg(unix)]
    #[test]
    fn the_secret_is_private_to_the_user() {
        use std::os::unix::fs::PermissionsExt;
        let file = secret_path("private")
            .parent()
            .unwrap()
            .join("private-dir/secret");
        let dir = file.parent().unwrap().to_path_buf();
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o755)).unwrap();
        std::fs::write(&file, "old").unwrap();
        std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o644)).unwrap();
        write_private(&file, "new").unwrap();
        let mode = |p: &Path| std::fs::metadata(p).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode(&file), 0o600);
        assert_eq!(mode(&dir), 0o700);
        assert_eq!(std::fs::read_to_string(&file).unwrap(), "new");
    }

    #[test]
    fn a_rejected_token_forgets_the_secret() {
        let file = secret_path("revoked");
        std::fs::write(&file, "old").unwrap();
        let (base, _requests) = fake_lightburn(vec![(401, r#"{"error":"Unauthorized"}"#)]);
        assert_eq!(
            open(&base, &file, "a.svg", "<svg/>"),
            Err(NEEDS_PAIRING.into())
        );
        assert!(!file.exists());
    }

    #[test]
    fn a_declined_pairing_and_a_closed_lightburn_have_their_own_errors() {
        let file = secret_path("declined");
        let (base, _requests) = fake_lightburn(vec![(403, r#"{"error":"Rejected"}"#)]);
        assert_eq!(pair(&base, &file), Err(DECLINED.into()));
        assert!(!file.exists());
        // Nothing listens on a port that was just closed
        let closed = {
            let l = TcpListener::bind("127.0.0.1:0").unwrap();
            format!("http://{}", l.local_addr().unwrap())
        };
        assert_eq!(pair(&closed, &file), Err(NOT_RUNNING.into()));
    }
}
