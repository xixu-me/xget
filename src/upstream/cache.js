/**
 * Cache helpers for upstream request handling.
 */

/**
 * Reads the default Cloudflare cache when available.
 * @returns {Cache | null} Default runtime cache, or null when unavailable.
 */
export function getDefaultCache() {
  // @ts-ignore - Cloudflare Workers cache API
  return typeof caches !== 'undefined' && /** @type {any} */ (caches).default // eslint-disable-line jsdoc/reject-any-type
    ? // @ts-ignore - Cloudflare Workers cache API
      /** @type {any} */ (caches).default // eslint-disable-line jsdoc/reject-any-type
    : null;
}

/**
 * Attempts to satisfy a request from cache before reaching the upstream.
 * @param {{
 *   cache: Cache | null,
 *   cacheTargetUrl: string,
 *   canUseCache: boolean,
 *   hasSensitiveHeaders: boolean,
 *   monitor: import('../utils/performance.js').PerformanceMonitor,
 *   request: Request,
 *   requestContext: {
 *     isAI: boolean,
 *     isDocker: boolean,
 *     isGit: boolean,
 *     isGitLFS: boolean,
 *     isHF: boolean
 *   }
 * }} options
 * @returns {Promise<Response | null>} Cached response when one can be reused, otherwise null.
 */
export async function tryReadCachedResponse({
  cache,
  cacheTargetUrl,
  canUseCache,
  hasSensitiveHeaders,
  monitor,
  request,
  requestContext
}) {
  const { isAI, isDocker, isGit, isGitLFS, isHF } = requestContext;

  if (
    !cache ||
    !canUseCache ||
    isGit ||
    isGitLFS ||
    isDocker ||
    isAI ||
    isHF ||
    hasSensitiveHeaders
  ) {
    return null;
  }

  try {
    const cacheKey = new Request(cacheTargetUrl, {
      method: 'GET',
      headers: request.headers
    });
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      monitor.mark('cache_hit');
      return cachedResponse;
    }

    const rangeHeader = request.headers.get('Range');
    if (!rangeHeader) {
      return null;
    }

    const fullContentKey = new Request(cacheTargetUrl, {
      method: 'GET',
      headers: new Headers(
        [...request.headers.entries()].filter(([key]) => key.toLowerCase() !== 'range')
      )
    });
    const fullCachedResponse = await cache.match(fullContentKey);
    if (fullCachedResponse) {
      monitor.mark('cache_hit_full_content');
      return fullCachedResponse;
    }
  } catch (cacheError) {
    console.warn('Cache API unavailable:', cacheError);
  }

  return null;
}
