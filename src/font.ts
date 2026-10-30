// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// The font built into the command line and kerfscript.wasm, under the same
// name the playground uses. The npm library does not include it, so browser
// bundles stay small. Atkinson Hyperlegible, SIL Open Font License 1.1, see
// fonts/OFL.txt.

import data from '../fonts/AtkinsonHyperlegible-Regular.ttf';

export const BUILTIN_FONT = 'Atkinson';

/** Adds the built-in font after the given fonts, unless one has its name. */
export function withBuiltinFont(fonts: Record<string, Uint8Array>): Record<string, Uint8Array> {
  return BUILTIN_FONT in fonts ? fonts : { ...fonts, [BUILTIN_FONT]: data };
}
