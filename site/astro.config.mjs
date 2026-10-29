// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://kerfscript.mylasertools.com',
  output: 'static',
  trailingSlash: 'always',
  // Keep HTML pages as the canonical sitemap entries. Markdown companions
  // are discoverable through their HTML alternate links and llms.txt.
  integrations: [
    sitemap({ filter: (page) => !page.includes('/404') && !/\.(?:md|txt)$/.test(page) }),
  ],
});
