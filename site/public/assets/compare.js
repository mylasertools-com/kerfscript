// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Model cards: the cut parts on the left of the line, the assembled model on
// the right. Move the pointer across the picture to move the line.

for (const fig of document.querySelectorAll('[data-compare]')) {
  const set = (x) => fig.style.setProperty('--pos', `${Math.min(100, Math.max(0, x * 100))}%`);
  fig.addEventListener('pointermove', (e) => {
    const r = fig.getBoundingClientRect();
    set((e.clientX - r.left) / r.width);
  });
  fig.addEventListener('pointerleave', () => fig.style.removeProperty('--pos'));
}
