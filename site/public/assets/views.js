// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Material / laser file switch on model pages.

for (const box of document.querySelectorAll('[data-views]')) {
  const tabs = box.querySelectorAll('[data-view]');
  for (const tab of tabs)
    tab.addEventListener('click', () => {
      for (const t of tabs) t.setAttribute('aria-selected', String(t === tab));
      for (const panel of box.querySelectorAll('[data-panel]'))
        panel.hidden = panel.dataset.panel !== tab.dataset.view;
    });
}
