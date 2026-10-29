import type { APIRoute } from 'astro';
import { markdownResponse, playgroundMarkdown } from '../../lib/agent-content.mjs';

export const GET: APIRoute = () => markdownResponse(playgroundMarkdown());
