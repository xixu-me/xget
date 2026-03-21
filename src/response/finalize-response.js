import {
  isFlatpakReferenceFilePath,
  rewriteTextResponse,
  shouldRewriteTextResponse
} from '../utils/rewrite.js';
import { addSecurityHeaders, createErrorResponse } from '../utils/security.js';

/**
 * Wraps an unsuccessful upstream response into the user-facing error contract.
 * @param {{
 *   effectivePath: string,
 *   platform: string,
 *   request: Request,
 *   requestContext: {
 *     isAI: boolean,
 *     isDocker: boolean,
 *     isGit: boolean,
 *     isGitLFS: boolean,
 *     isHF: boolean
 *   },
 *   response: Response,
 *   responseGeneratedLocally: boolean,
 *   url: URL
 * }} options
 * @returns {Promise<Response>} Final error response.
 */
async function finalizeErrorResponse({ requestContext, response, responseGeneratedLocally }) {
  if (responseGeneratedLocally || response.ok || response.status === 206) {
    return response;
  }

  if (requestContext.isDocker && response.status === 401) {
    if (!response.headers.has('WWW-Authenticate')) {
      const isCustomError =
        response.headers.get('content-type') === 'application/json' &&
        (await response.clone().text()).includes('UNAUTHORIZED');

      if (!isCustomError) {
        const errorText = await response.text().catch(() => '');
        return createErrorResponse(
          `Authentication required for this container registry resource. This may be a private repository. Original error: ${errorText}`,
          401,
          true
        );
      }
    }

    return response;
  }

  const errorText = await response.text().catch(() => 'Unknown error');
  return createErrorResponse(
    `Upstream server error (${response.status}): ${errorText}`,
    response.status,
    true
  );
}

/**
 * Finalizes a successful upstream response, including rewriting, cache headers, and background cache writes.
 * @param {{
 *   cache: Cache | null,
 *   cacheTargetUrl: string,
 *   canUseCache: boolean,
 *   config: import('../config/index.js').ApplicationConfig,
 *   ctx: ExecutionContext,
 *   effectivePath: string,
 *   hasSensitiveHeaders: boolean,
 *   monitor: import('../utils/performance.js').PerformanceMonitor,
 *   platform: string,
 *   request: Request,
 *   requestContext: {
 *     isAI: boolean,
 *     isDocker: boolean,
 *     isGit: boolean,
 *     isGitLFS: boolean,
 *     isHF: boolean
 *   },
 *   response: Response,
 *   url: URL
 * }} options
 * @returns {Promise<Response>} Final proxied response.
 */
async function finalizeSuccessfulResponse({
  cache,
  cacheTargetUrl,
  canUseCache,
  config,
  ctx,
  effectivePath,
  hasSensitiveHeaders,
  monitor,
  platform,
  request,
  requestContext,
  response,
  url
}) {
  const { isAI, isDocker, isGit, isGitLFS, isHF } = requestContext;

  /** @type {string | ReadableStream<Uint8Array> | null} */
  let responseBody = response.body;
  let rewrittenContentLength = null;
  let hasOriginBoundRewrite = false;

  if (
    shouldRewriteTextResponse(platform, effectivePath, response.headers.get('content-type') || '')
  ) {
    const originalText =
      platform === 'flathub' && isFlatpakReferenceFilePath(effectivePath)
        ? new TextDecoder().decode(await response.arrayBuffer())
        : await response.text();
    const rewrittenText = rewriteTextResponse(platform, effectivePath, originalText, url.origin);
    responseBody = rewrittenText;
    rewrittenContentLength = new TextEncoder().encode(rewrittenText).byteLength;
    hasOriginBoundRewrite = platform === 'pypi';
  }

  const headers = new Headers(response.headers);

  if (rewrittenContentLength !== null) {
    headers.set('Content-Length', String(rewrittenContentLength));
  }

  if (!isGit && !isGitLFS && !isDocker && !isAI && !isHF) {
    if (!canUseCache || hasOriginBoundRewrite) {
      headers.set('Cache-Control', 'no-store');
    } else if (hasSensitiveHeaders) {
      headers.set('Cache-Control', 'private, no-store');
      const existingVary = headers.get('Vary');
      headers.set(
        'Vary',
        existingVary ? `${existingVary}, Authorization, Cookie` : 'Authorization, Cookie'
      );
    } else {
      headers.set('Cache-Control', `public, max-age=${config.CACHE_DURATION}`);
    }

    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Accept-Ranges', 'bytes');

    if (!headers.has('Content-Length') && response.status === 200) {
      try {
        const contentLength = response.headers.get('Content-Length');
        if (contentLength) {
          headers.set('Content-Length', contentLength);
        }
      } catch (error) {
        console.warn('Could not set Content-Length header:', error);
      }
    }

    addSecurityHeaders(headers);
  }

  let finalizedResponse = new Response(responseBody, {
    status: response.status,
    headers
  });

  if (
    cache &&
    !isGit &&
    !isGitLFS &&
    !isDocker &&
    !isAI &&
    !isHF &&
    !hasOriginBoundRewrite &&
    !hasSensitiveHeaders &&
    request.method === 'GET' &&
    finalizedResponse.ok &&
    finalizedResponse.status === 200
  ) {
    const rangeHeader = request.headers.get('Range');
    const cacheKey = rangeHeader
      ? new Request(cacheTargetUrl, {
          method: 'GET',
          headers: new Headers(
            [...request.headers.entries()].filter(([key]) => key.toLowerCase() !== 'range')
          )
        })
      : new Request(cacheTargetUrl, { method: 'GET' });

    try {
      if (ctx && typeof ctx.waitUntil === 'function') {
        ctx.waitUntil(cache.put(cacheKey, finalizedResponse.clone()));
      } else {
        cache.put(cacheKey, finalizedResponse.clone()).catch(error => {
          console.warn('Cache put failed:', error);
        });
      }

      if (rangeHeader && finalizedResponse.status === 200) {
        const rangedResponse = await cache.match(
          new Request(cacheTargetUrl, {
            method: 'GET',
            headers: request.headers
          })
        );
        if (rangedResponse) {
          monitor.mark('range_cache_hit_after_full_cache');
          finalizedResponse = rangedResponse;
        }
      }
    } catch (cacheError) {
      console.warn('Cache put/match failed:', cacheError);
    }
  }

  return finalizedResponse;
}

/**
 * Finalizes the upstream response after cache lookup and fetch execution.
 * @param {{
 *   cache: Cache | null,
 *   cacheTargetUrl: string,
 *   canUseCache: boolean,
 *   config: import('../config/index.js').ApplicationConfig,
 *   ctx: ExecutionContext,
 *   effectivePath: string,
 *   hasSensitiveHeaders: boolean,
 *   monitor: import('../utils/performance.js').PerformanceMonitor,
 *   platform: string,
 *   request: Request,
 *   requestContext: {
 *     isAI: boolean,
 *     isDocker: boolean,
 *     isGit: boolean,
 *     isGitLFS: boolean,
 *     isHF: boolean
 *   },
 *   response: Response,
 *   responseGeneratedLocally: boolean,
 *   url: URL
 * }} options
 * @returns {Promise<Response>} Final response returned to the client.
 */
export async function finalizeResponse({
  cache,
  cacheTargetUrl,
  canUseCache,
  config,
  ctx,
  effectivePath,
  hasSensitiveHeaders,
  monitor,
  platform,
  request,
  requestContext,
  response,
  responseGeneratedLocally,
  url
}) {
  const errorResponse = await finalizeErrorResponse({
    effectivePath,
    platform,
    request,
    requestContext,
    response,
    responseGeneratedLocally,
    url
  });

  if (errorResponse !== response || !errorResponse.ok) {
    return errorResponse;
  }

  return await finalizeSuccessfulResponse({
    cache,
    cacheTargetUrl,
    canUseCache,
    config,
    ctx,
    effectivePath,
    hasSensitiveHeaders,
    monitor,
    platform,
    request,
    requestContext,
    response: errorResponse,
    url
  });
}
