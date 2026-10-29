import type { APIRoute } from 'astro';
import { llmsText } from '../lib/agent-content.mjs';

export const GET: APIRoute = () =>
  new Response(llmsText(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
