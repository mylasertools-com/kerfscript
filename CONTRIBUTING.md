# Contributing

Thanks for helping make KerfScript better.

## Before you start

- **Sign the CLA.** Every pull request needs the [Contributor License
  Agreement](CLA.md) line in its description. We can't merge contributions
  without it, because it lets us keep offering KerfScript under both the AGPL
  and commercial licences.
- **Language changes start as an issue.** New syntax, new built-in modules or
  changes to how existing programs behave need agreement first, so the
  language stays one consistent standard. Bug fixes, docs, examples and
  standard library modules can go straight to a pull request.

## Setup

```sh
npm install
npm run check   # build and test
```

Tests use `node --test` and run against the built `dist/`, so build before
testing. Standard library files live in `lib/` as `.kerf` source and are
compiled into `src/stdlib.ts` by the build.

## Guidelines

- Keep programs that worked before working. If a change must break programs,
  it waits for the next language version and goes in the changelog.
- Every new built-in gets a test and an entry in [LANGUAGE.md](LANGUAGE.md).
- New source files start with the copyright and SPDX header used in `src/`.
- No new runtime dependencies without discussion. Anything bundled must use a
  permissive licence (MIT, BSD, Apache-2.0, BSL-1.0, ISC) so dual licensing
  stays possible.
- Format with `npm run format`.
