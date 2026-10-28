import type { APIRoute } from 'astro';
import { models } from '../../lib/site.mjs';

export const GET: APIRoute = () =>
  new Response(JSON.stringify(Object.fromEntries(models.map((m) => [m.slug, m.source]))), {
    headers: { 'Content-Type': 'application/json' },
  });
