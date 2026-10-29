import type { APIRoute } from 'astro';
import {
  aboutMarkdown,
  docsMarkdown,
  guideMarkdown,
  homeMarkdown,
  licenceMarkdown,
  modelMarkdown,
  modelsMarkdown,
  playgroundMarkdown,
} from '../lib/agent-content.mjs';
import { GUIDES, models } from '../lib/site.mjs';

export const GET: APIRoute = () =>
  new Response(
    [
      homeMarkdown(),
      aboutMarkdown(),
      docsMarkdown(),
      ...[...GUIDES.map(([slug]) => slug), 'reference'].map(guideMarkdown),
      modelsMarkdown(),
      ...models.map(modelMarkdown),
      playgroundMarkdown(),
      licenceMarkdown(),
    ].join('\n\n---\n\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
