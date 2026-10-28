import type { APIRoute } from 'astro';
import { BASE } from '../lib/site.mjs';

export const GET: APIRoute = () =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap-index.xml\n`, {
    headers: { 'Content-Type': 'text/plain' },
  });
