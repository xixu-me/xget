/**
 * Xget - High-performance acceleration engine for developer resources
 * Copyright (C) Xi Xu
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

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
