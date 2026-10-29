// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Sends plain http visits to https, then serves the built site.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }
    const response = await env.ASSETS.fetch(request);
    if (!url.pathname.endsWith('/index.md') || !response.ok) return response;

    // The Markdown file is for text readers. Keep the matching HTML page as
    // the preferred Search result while leaving both formats crawlable.
    const headers = new Headers(response.headers);
    headers.set('Content-Type', 'text/markdown; charset=utf-8');
    headers.set(
      'Link',
      `<${url.origin}${url.pathname.slice(0, -'index.md'.length)}>; rel="canonical"`,
    );
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
