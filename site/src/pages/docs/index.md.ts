import type { APIRoute } from 'astro';
import { docsMarkdown, markdownResponse } from '../../lib/agent-content.mjs';

export const GET: APIRoute = () => markdownResponse(docsMarkdown());
