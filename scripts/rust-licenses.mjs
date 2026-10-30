// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Lists the Rust crates compiled into a binary with their licences, source
// links and licence texts, as Markdown. Used for the desktop app
// (desktop/scripts/licenses.mjs), for kerfscript.wasm, whose JavaScript
// engine comes from Javy (scripts/wasm-licenses.mjs), and for the kerf
// command line, whose runtime comes from Deno (scripts/cli-licenses.mjs).
//
// A crate's licence texts are the licence files it ships, including those of
// C or C++ sources it bundles. A crate published without any comes from
// packaging/licenses/<crate>-<version>/: the licence files of its repository
// at the commit the crate was published from. `--fetch` downloads those with
// the GitHub CLI to be checked; without them, the list is not written.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const LICENCE_FILE = /^(licen[cs]e|copying|notice|copyright|unlicense)([-_.].*)?$/i;
const SKIP_DIRS = /^(\.|target$|tests?$|benches$|examples?$|fixtures$|docs?$)/;
const UPSTREAM = fileURLToPath(new URL('../packaging/licenses/', import.meta.url));
// Repositories of crates whose package metadata leaves them out
const REPOSITORIES = {
  'aead-gcm-stream': 'https://github.com/littledivy/aead-gcm-stream',
  'libappindicator-sys': 'https://github.com/tauri-apps/libappindicator-rs',
  'zune-core': 'https://github.com/etemesi254/zune-image',
};

// Crates whose code is in the binary: normal dependencies, without
// build-dependencies, dev-dependencies or proc-macros, which only run while
// compiling.
function compiledCrates(manifestDir, targets, rootName) {
  const crates = new Map();
  for (const target of targets) {
    const meta = JSON.parse(
      execFileSync(
        'cargo',
        ['metadata', '--format-version', '1', '--locked', '--filter-platform', target],
        { cwd: manifestDir, maxBuffer: 1 << 28 },
      ),
    );
    const packages = new Map(meta.packages.map((p) => [p.id, p]));
    const nodes = new Map(meta.resolve.nodes.map((n) => [n.id, n]));
    const root = rootName ? meta.packages.find((p) => p.name === rootName).id : meta.resolve.root;
    const macro = (id) => packages.get(id).targets.every((t) => t.kind.includes('proc-macro'));
    const queue = [root];
    const seen = new Set(queue);
    while (queue.length) {
      for (const dep of nodes.get(queue.pop()).deps) {
        if (!dep.dep_kinds.some((k) => k.kind === null) || seen.has(dep.pkg) || macro(dep.pkg))
          continue;
        seen.add(dep.pkg);
        queue.push(dep.pkg);
      }
    }
    for (const id of seen)
      crates.set(id, { ...packages.get(id), workspace: meta.workspace_root, own: id === root });
  }
  return crates;
}

// Licence files in a folder and in the folders below it that bundle sources
function licenceFiles(dir, depth = 2) {
  const found = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isFile() && LICENCE_FILE.test(name)) found.push(path);
    else if (stat.isDirectory() && depth > 0 && !SKIP_DIRS.test(name))
      found.push(...licenceFiles(path, depth - 1));
  }
  return found;
}

const normalise = (body) =>
  body
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .trim();

function github(repository) {
  const m = /github\.com[/:]([^/]+)\/([^/#?]+?)(?:\.git)?(?:[/#?]|$)/.exec(repository ?? '');
  return m ? { owner: m[1], repo: m[2] } : null;
}

// Downloads the licence files of a crate's repository at its published commit
function fetchUpstream(pkg, into) {
  const dir = dirname(pkg.manifest_path);
  const vcs = join(dir, '.cargo_vcs_info.json');
  const gh = github(pkg.repository ?? REPOSITORIES[pkg.name]);
  if (!existsSync(vcs) || !gh)
    throw new Error(`${pkg.name} ${pkg.version}: no published commit or GitHub repository`);
  const { git, path_in_vcs: inVcs = '' } = JSON.parse(readFileSync(vcs, 'utf8'));
  const api = (path, raw) =>
    execFileSync(
      'gh',
      [
        'api',
        ...(raw ? ['-H', 'Accept: application/vnd.github.raw'] : []),
        `repos/${gh.owner}/${gh.repo}/contents/${path}?ref=${git.sha1}`,
      ],
      { encoding: 'utf8', maxBuffer: 1 << 26 },
    );
  // The crate's folder in the repository, then each folder above it
  const parts = inVcs ? inVcs.split('/') : [];
  for (let n = parts.length; n >= 0; n--) {
    const folder = parts.slice(0, n).join('/');
    const files = JSON.parse(api(folder)).filter(
      (f) => f.type === 'file' && LICENCE_FILE.test(f.name),
    );
    if (!files.length) continue;
    mkdirSync(into, { recursive: true });
    const urls = [];
    for (const f of files) {
      writeFileSync(join(into, f.name), api(f.path, true));
      urls.push(`https://github.com/${gh.owner}/${gh.repo}/blob/${git.sha1}/${f.path}`);
    }
    writeFileSync(join(into, 'SOURCE.txt'), urls.join('\n') + '\n');
    return;
  }
  throw new Error(`${pkg.name} ${pkg.version}: no licence file in its repository`);
}

/**
 * The licence list as Markdown. Options: manifestDir, targets, rootName (the
 * package to start from; default the workspace root), includeRoot (list that
 * package too), title, intro (Markdown), pathSource (link for crates that are
 * not from crates.io), fetch.
 */
export function rustLicenses({
  manifestDir,
  targets,
  rootName,
  includeRoot,
  title,
  intro,
  pathSource,
  fetch,
}) {
  const crates = [...compiledCrates(manifestDir, targets, rootName).values()]
    .filter((p) => includeRoot || !p.own)
    .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
  const texts = new Map();
  const rows = [];
  const unresolved = [];
  for (const pkg of crates) {
    const id = `${pkg.name} ${pkg.version}`;
    const dir = dirname(pkg.manifest_path);
    let files = licenceFiles(dir).map((path) => ({ path, label: relative(dir, path) }));
    // Workspace crates without their own licence use the workspace's
    for (let up = dir; !files.length && !pkg.source && up.startsWith(pkg.workspace); ) {
      const parent = dirname(up);
      if (parent === up) break;
      up = parent;
      files = licenceFiles(up, 0).map((path) => ({ path, label: relative(dir, path) }));
    }
    // A crate with no licence file of its own (only those of sources it
    // bundles, or none) gets its repository's
    const own = files.some((f) => dirname(f.path) === dir);
    if (!own && pkg.source) {
      const upstream = join(UPSTREAM, `${pkg.name}-${pkg.version}`);
      if (!existsSync(upstream) && fetch) fetchUpstream(pkg, upstream);
      if (existsSync(upstream))
        files.unshift(
          ...readdirSync(upstream)
            .filter((f) => f !== 'SOURCE.txt')
            .sort()
            .map((f) => ({ path: join(upstream, f), label: `${f} (added)` })),
        );
      else unresolved.push(id);
    }
    if (!files.length && !unresolved.includes(id)) unresolved.push(id);
    const refs = [];
    for (const { path, label } of files) {
      const body = normalise(readFileSync(path, 'utf8'));
      if (!body) continue;
      const hash = createHash('sha256').update(body).digest('hex').slice(0, 12);
      if (!texts.has(hash)) texts.set(hash, { body, crates: [] });
      const users = texts.get(hash).crates;
      if (!users.includes(id)) users.push(id);
      refs.push(`[${label.replace(/\\/g, '/')}](#${hash})`);
    }
    const source = pkg.source
      ? `[crates.io](https://crates.io/crates/${pkg.name}/${pkg.version})`
      : `[source](${pathSource})`;
    rows.push(
      `| ${pkg.name} | ${pkg.version} | ${pkg.license ?? 'see files'} | ${source} | ${refs.join(', ')} |`,
    );
  }
  if (unresolved.length)
    throw new Error(
      `No licence text for ${unresolved.join(', ')}. Run with --fetch to download the licence files of their repositories into packaging/licenses/, then check them.`,
    );
  const fence = (body) => {
    let ticks = '```';
    while (body.includes(ticks)) ticks += '`';
    return `${ticks}text\n${body}\n${ticks}`;
  };
  return `# ${title}

${intro}

Every crate's source is available from the link in the Source column:
crates.io keeps each published version. Licence files marked "(added)" are
not in the published crate: they are the licence files of the crate's
repository at the commit it was published from, or the licence text the
crate's source files refer to. packaging/licenses/ keeps them, with where each
came from.

| Crate | Version | Licence | Source | Licence files |
| --- | --- | --- | --- | --- |
${rows.join('\n')}

## Licence texts
${[...texts]
  .map(
    ([hash, { body, crates: users }]) =>
      `\n<a id="${hash}"></a>\n\n### ${users.join(', ')}\n\n${fence(body)}\n`,
  )
  .join('')}`;
}

/** Writes the list, or with --check fails when the file differs. */
export function writeOrCheck(out, doc, name) {
  if (process.argv.includes('--check')) {
    const current = existsSync(out) ? readFileSync(out, 'utf8') : '';
    if (current !== doc) {
      console.error(`${name} is out of date: run the script without --check`);
      process.exit(1);
    }
    console.log(`${name} is up to date`);
  } else {
    writeFileSync(out, doc);
    console.log(`Wrote ${name}`);
  }
}
