import type { APIRoute } from 'astro';
import { homeMarkdown, markdownResponse } from '../lib/agent-content.mjs';

export const GET: APIRoute = () => markdownResponse(homeMarkdown());
