// Edge function: source protection
// Block direct browser navigation & curl/wget to JS/CSS files
// Allow legitimate page resource loads (script/style tags, XHR from page)
export default async (request, context) => {
  const url = new URL(request.url);
  const path = url.pathname;
  const userAgent = request.headers.get('user-agent') || '';
  const referer = request.headers.get('referer') || '';
  const secFetchDest = request.headers.get('sec-fetch-dest') || '';
  const secFetchMode = request.headers.get('sec-fetch-mode') || '';

  const isProtectedJS = path.endsWith('.js') && path !== '/manifest.json';
  const isProtectedCSS = path === '/style.css';

  if (isProtectedJS || isProtectedCSS) {
    const hasValidReferer = referer.includes('.netlify.app') || referer.includes('localhost');

    // ALLOW: service worker registration
    if (path === '/sw.js' && (secFetchDest === 'serviceworker' || hasValidReferer)) {
      return context.next();
    }

    // ALLOW: legitimate resource loads from page
    // - Has referer from our site (page is loading scripts/styles)
    // - sec-fetch-dest is script/style/empty (XHR)
    const isLegitimateLoad = hasValidReferer && (
      secFetchDest === 'script' ||
      secFetchDest === 'style' ||
      secFetchDest === 'empty' ||    // XHR/fetch from page
      secFetchDest === ''            // Safari often sends empty
    );

    // ALLOW: has valid referer + looks like real browser
    // Safari doesn't always send sec-fetch headers, so referer alone is enough
    if (isLegitimateLoad || (hasValidReferer && userAgent.length > 20)) {
      const response = await context.next();
      const newHeaders = new Headers(response.headers);
      newHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      newHeaders.set('X-Content-Type-Options', 'nosniff');
      newHeaders.set('X-Download-Options', 'noopen');
      newHeaders.set('Content-Disposition', 'inline');
      newHeaders.delete('SourceMap');
      newHeaders.delete('X-SourceMap');
      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      });
    }

    // BLOCK: direct navigation (typing URL in address bar)
    const isDirectNavigation = secFetchDest === 'document' || secFetchMode === 'navigate';
    // BLOCK: no referer + no sec-fetch = curl/wget
    const isSuspicious = !hasValidReferer && !secFetchDest;

    if (isDirectNavigation || isSuspicious || !hasValidReferer) {
      const contentType = isProtectedJS ? 'application/javascript' : 'text/css';
      const empty = isProtectedJS ? 'void 0;' : '/* */';
      return new Response(empty, {
        status: 200,
        headers: {
          'content-type': contentType,
          'cache-control': 'no-store',
          'x-robots-tag': 'noindex, noarchive, nosnippet',
        },
      });
    }
  }

  // HTML — add anti-save headers
  if (path === '/' || path === '/index.html') {
    const response = await context.next();
    const newHeaders = new Headers(response.headers);
    newHeaders.set('X-Download-Options', 'noopen');
    newHeaders.set('Content-Disposition', 'inline');
    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  }

  return context.next();
};

export const config = {
  path: ["/*.js", "/style.css", "/", "/index.html"],
};
