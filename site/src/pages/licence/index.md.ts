import type { APIRoute } from 'astro';
import { licenceMarkdown, markdownResponse } from '../../lib/agent-content.mjs';

export const GET: APIRoute = () => markdownResponse(licenceMarkdown());
