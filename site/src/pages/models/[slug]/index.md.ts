import type { APIRoute } from 'astro';
import { markdownResponse, modelMarkdown } from '../../../lib/agent-content.mjs';
import { models } from '../../../lib/site.mjs';

export function getStaticPaths() {
  return models.map((model) => ({ params: { slug: model.slug }, props: { model } }));
}

export const GET: APIRoute = ({ props }) => markdownResponse(modelMarkdown(props.model));
