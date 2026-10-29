import type { APIRoute } from 'astro';
import { aboutMarkdown, markdownResponse } from '../../lib/agent-content.mjs';

export const GET: APIRoute = () => markdownResponse(aboutMarkdown());
