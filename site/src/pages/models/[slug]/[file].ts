import type { APIRoute } from 'astro';
import { models } from '../../../lib/site.mjs';

const TYPES = { kerf: 'text/plain', svg: 'image/svg+xml', dxf: 'application/dxf' };

export function getStaticPaths() {
  return models.flatMap((m) =>
    [
      ['kerf', m.source],
      ['svg', m.laser],
      ['dxf', m.dxf],
    ]
      .filter(([, body]) => body)
      .map(([ext, body]) => ({
        params: { slug: m.slug, file: `${m.slug}.${ext}` },
        props: { ext, body },
      }))
      .concat(
        m.sheetFiles.flatMap((s) =>
          ['svg', 'dxf'].map((ext) => ({
            params: { slug: m.slug, file: `${s.name}.${ext}` },
            props: { ext, body: s[ext] },
          })),
        ),
      ),
  );
}

export const GET: APIRoute = ({ props }) =>
  new Response(props.body, { headers: { 'Content-Type': TYPES[props.ext as keyof typeof TYPES] } });
