import type { APIRoute } from 'astro';
import { guideMarkdown, markdownResponse } from '../../../lib/agent-content.mjs';
import { GUIDES } from '../../../lib/site.mjs';

export function getStaticPaths() {
  return [...GUIDES.map(([guide]) => ({ params: { guide } })), { params: { guide: 'reference' } }];
}

export const GET: APIRoute = ({ params }) => markdownResponse(guideMarkdown(params.guide!));
