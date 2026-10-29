import type { APIRoute } from 'astro';
import { BASE } from '../lib/site.mjs';

export const GET: APIRoute = () =>
  new Response(
    `# Public search, answer, agent and model-training crawlers are welcome.\nUser-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap-index.xml\n`,
    {
      headers: { 'Content-Type': 'text/plain' },
    },
  );
