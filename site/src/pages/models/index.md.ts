import type { APIRoute } from 'astro';
import { markdownResponse, modelsMarkdown } from '../../lib/agent-content.mjs';

export const GET: APIRoute = () => markdownResponse(modelsMarkdown());
