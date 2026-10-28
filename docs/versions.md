# Versions

KerfScript has two version numbers.

- The **language version** (now 0.1) covers what `.kerf` files mean: the
  syntax, the built-in modules and functions, and the rules for layers, kerf
  and parts. The [language reference](../LANGUAGE.md) describes one language
  version.
- The **package version** (now 0.2.0) is the version of the interpreter, the
  `kerf` command and the JavaScript API. It changes more often: bug fixes,
  new output options and API additions do not change the language.

The site footer, `kerf --version` and the `VERSION` and `LANGUAGE_VERSION`
exports show both.

## Before 1.0

KerfScript is young, and the language may still change before 1.0. What we
promise in the meantime:

- **Changes are written down.** Every change that can alter what a file
  produces is listed in the changelog under the version that made it.
- **Files keep running where we can manage it.** A program that worked keeps
  working, or stops with an error that says what to change. It does not
  silently start cutting something different.
- **Geometry changes are called out.** If the same file starts producing
  different geometry, for example after a packing or text layout fix, the
  changelog says which designs are affected.
- **Breaking changes raise the language version.** Package releases within
  one language version do not remove or rename anything in the language.

## From 1.0

From language version 1.0, `.kerf` files written for 1.x keep producing the
same parts in every later 1.x interpreter, apart from bug fixes listed in the
changelog. New features are additions. Anything that would change existing
files waits for 2.0.

## Pinning a version

Hosts that store designs, like MyLaserTools, record which interpreter
version a design was published with, so a stored design can be checked
against later versions before it is upgraded.
