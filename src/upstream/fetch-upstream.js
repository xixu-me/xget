import { configureAIHeaders } from '../protocols/ai.js';
import {
  fetchToken,
  getScopeFromUrl,
  parseAuthenticate,
  readRegistryTokenResponse,
  responseUnauthorized
} from '../protocols/docker.js';
import { configureGitHeaders } from '../protocols/git.js';
import { configureHuggingFaceHeaders } from '../protocols/huggingface.js';
import { createErrorResponse } from '../utils/security.js';

const MEDIA_FILE_PATTERN =
  /\.(mp4|avi|mkv|mov|wmv|flv|webm|mp3|wav|flac|aac|ogg|jpg|jpeg|png|gif|bmp|svg|pdf|zip|rar|7z|tar|gz|bz2|xz)$/i;

/**
 * Creates upstream fetch options for the current request.
 * @param {{
 *   authorization: string | null,
 *   canUseCache: boolean,
 *   config: import('../config/index.js').ApplicationConfig,
 *   request: Request,
 *   requestContext: {
 *     isAI: boolean,
 *     isDocker: boolean,
 *     isGit: boolean,
 *     isGitLFS: boolean,
 *     isHF: boolean,
 *     url: URL
 *   },
 *   shouldPassthroughRequest: boolean,
 *   targetUrl: string
 * }} options
 * @returns {{ fetchOptions: RequestInit, requestHeaders: Headers }} Fetch options and mutable headers.
 */
function createFetchOptions({
  authorization,
  canUseCache,
  config,
  request,
  requestContext,
  shouldPassthroughRequest,
  targetUrl
}) {
  const { isAI, isGit, isGitLFS, isHF, url } = requestContext;

  /** @type {RequestInit} */
  const fetchOptions = {
    method: request.method,
    headers: new Headers(),
    redirect: 'follow'
  };

  if (request.body !== null && !canUseCache) {
    fetchOptions.body = request.body;
  }

  const requestHeaders = /** @type {Headers} */ (fetchOptions.headers);

  if (shouldPassthroughRequest) {
    for (const [key, value] of request.headers.entries()) {
      if (!['host', 'connection', 'upgrade', 'proxy-connection'].includes(key.toLowerCase())) {
        requestHeaders.set(key, value);
      }
    }

    if (isGit || isGitLFS) {
      configureGitHeaders(requestHeaders, request, url, isGitLFS);
    }

    if (isAI) {
      configureAIHeaders(requestHeaders, request);
    }

    if (isHF) {
      configureHuggingFaceHeaders(requestHeaders, request);
    }

    return { fetchOptions, requestHeaders };
  }

  Object.assign(fetchOptions, {
    cf: {
      http3: true,
      cacheTtl: config.CACHE_DURATION,
      cacheEverything: true,
      preconnect: true
    }
  });

  requestHeaders.set('Accept-Encoding', 'gzip, deflate, br');
  requestHeaders.set('Connection', 'keep-alive');
  requestHeaders.set('User-Agent', 'Wget/1.21.3');

  const origin = request.headers.get('Origin');
  if (origin) {
    requestHeaders.set('Origin', origin);
  }

  if (authorization) {
    requestHeaders.set('Authorization', authorization);
  }

  const rangeHeader = request.headers.get('Range');
  if (MEDIA_FILE_PATTERN.test(targetUrl) || rangeHeader) {
    requestHeaders.set('Accept-Encoding', 'identity');
  }

  if (rangeHeader) {
    requestHeaders.set('Range', rangeHeader);
  }

  return { fetchOptions, requestHeaders };
}

/**
 * Follows a Docker redirect without forwarding credentials to the redirected host.
 * @param {Response} response
 * @param {string} targetUrl
 * @param {RequestInit} finalFetchOptions
 * @returns {Promise<Response>} Redirect-followed response, or the original response when no redirect is needed.
 */
async function followDockerRedirectIfNeeded(response, targetUrl, finalFetchOptions) {
  if (
    response.status !== 301 &&
    response.status !== 302 &&
    response.status !== 303 &&
    response.status !== 307 &&
    response.status !== 308
  ) {
    return response;
  }

  const location = response.headers.get('Location');
  if (!location) {
    return response;
  }

  const redirectHeaders = new Headers(finalFetchOptions.headers);
  redirectHeaders.delete('Authorization');

  const redirectOptions = /** @type {RequestInit} */ ({
    ...finalFetchOptions,
    headers: redirectHeaders,
    redirect: 'follow'
  });

  return await fetch(new URL(location, targetUrl), redirectOptions);
}

/**
 * Executes the upstream fetch, including HEAD fallback probing and Docker redirect handling.
 * @param {{
 *   fetchOptions: RequestInit,
 *   request: Request,
 *   requestContext: {
 *     isDocker: boolean
 *   },
 *   requestHeaders: Headers,
 *   targetUrl: string
 * }} options
 * @returns {Promise<Response>} Upstream response.
 */
async function executeFetch({ fetchOptions, request, requestContext, requestHeaders, targetUrl }) {
  const finalFetchOptions = /** @type {RequestInit} */ ({
    ...fetchOptions,
    signal: /** @type {AbortSignal} */ (fetchOptions.signal)
  });

  if (requestContext.isDocker) {
    finalFetchOptions.redirect = 'manual';
  }

  let response;
  if (request.method === 'HEAD') {
    response = await fetch(targetUrl, finalFetchOptions);

    if (response.ok && !response.headers.get('Content-Length')) {
      const rangeHeaders = new Headers(requestHeaders);
      rangeHeaders.set('Range', 'bytes=0-0');

      const rangeResponse = await fetch(targetUrl, {
        ...finalFetchOptions,
        method: 'GET',
        headers: rangeHeaders
      });

      let contentLength = null;

      if (rangeResponse.status === 206) {
        const contentRange = rangeResponse.headers.get('Content-Range');
        if (contentRange) {
          const match = contentRange.match(/bytes\s+\d+-\d+\/(\d+)/);
          if (match) {
            [, contentLength] = match;
          }
        }
      } else if (rangeResponse.ok) {
        contentLength = rangeResponse.headers.get('Content-Length');
      }

      if (contentLength) {
        const headHeaders = new Headers(response.headers);
        headHeaders.set('Content-Length', contentLength);
        response = new Response(null, {
          status: response.status,
          statusText: response.statusText,
          headers: headHeaders
        });
      }
    }
  } else {
    response = await fetch(targetUrl, finalFetchOptions);
  }

  if (requestContext.isDocker) {
    response = await followDockerRedirectIfNeeded(response, targetUrl, finalFetchOptions);
  }

  return response;
}

/**
 * Retries a Docker request with an anonymous bearer token when the registry challenges first.
 * @param {{
 *   effectivePath: string,
 *   platform: string,
 *   requestHeaders: Headers,
 *   requestContext: {
 *     isDocker: boolean,
 *     url: URL
 *   },
 *   response: Response,
 *   targetUrl: string,
 *   finalFetchOptions: RequestInit
 * }} options
 * @returns {Promise<Response>} Successful retried response, or a synthesized auth challenge response.
 */
async function retryDockerWithAnonymousToken({
  effectivePath,
  finalFetchOptions,
  platform,
  requestContext,
  requestHeaders,
  response,
  targetUrl
}) {
  const authenticateStr = response.headers.get('WWW-Authenticate');
  const scope = getScopeFromUrl(requestContext.url, effectivePath, platform);

  if (authenticateStr) {
    try {
      const wwwAuthenticate = parseAuthenticate(authenticateStr);
      const tokenResponse = await fetchToken(wwwAuthenticate, scope || '', '');

      if (tokenResponse.ok) {
        const token = await readRegistryTokenResponse(tokenResponse);
        if (token) {
          const retryHeaders = new Headers(requestHeaders);
          retryHeaders.set('Authorization', `Bearer ${token}`);

          const retryOptions = /** @type {RequestInit} */ ({
            ...finalFetchOptions,
            headers: retryHeaders,
            redirect: 'manual'
          });

          let retryResponse = await fetch(targetUrl, retryOptions);
          retryResponse = await followDockerRedirectIfNeeded(
            retryResponse,
            targetUrl,
            retryOptions
          );

          if (retryResponse.ok) {
            return retryResponse;
          }
        }
      }
    } catch (error) {
      console.warn('Token fetch failed:', error);
    }
  }

  return responseUnauthorized(requestContext.url, platform);
}

/**
 * Fetches an upstream resource with retries and protocol-specific handling.
 * @param {{
 *   authorization: string | null,
 *   canUseCache: boolean,
 *   config: import('../config/index.js').ApplicationConfig,
 *   effectivePath: string,
 *   monitor: import('../utils/performance.js').PerformanceMonitor,
 *   platform: string,
 *   request: Request,
 *   requestContext: {
 *     isAI: boolean,
 *     isDocker: boolean,
 *     isGit: boolean,
 *     isGitLFS: boolean,
 *     isHF: boolean,
 *     url: URL
 *   },
 *   shouldPassthroughRequest: boolean,
 *   targetUrl: string
 * }} options
 * @returns {Promise<{ response: Response, responseGeneratedLocally: boolean }>} Upstream or synthesized response.
 */
export async function fetchUpstreamResponse({
  authorization,
  canUseCache,
  config,
  effectivePath,
  monitor,
  platform,
  request,
  requestContext,
  shouldPassthroughRequest,
  targetUrl
}) {
  let response;
  let responseGeneratedLocally = false;
  const { fetchOptions, requestHeaders } = createFetchOptions({
    authorization,
    canUseCache,
    config,
    request,
    requestContext,
    shouldPassthroughRequest,
    targetUrl
  });

  let attempts = 0;
  while (attempts < config.MAX_RETRIES) {
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timeoutId;

    try {
      monitor.mark(`attempt_${attempts}`);

      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), config.TIMEOUT_SECONDS * 1000);

      fetchOptions.signal = controller.signal;
      response = await executeFetch({
        fetchOptions,
        request,
        requestContext,
        requestHeaders,
        targetUrl
      });

      if (response.ok || response.status === 206) {
        monitor.mark('success');
        break;
      }

      if (requestContext.isDocker && response.status === 401) {
        monitor.mark('docker_auth_challenge');
        response = await retryDockerWithAnonymousToken({
          effectivePath,
          finalFetchOptions: fetchOptions,
          platform,
          requestContext,
          requestHeaders,
          response,
          targetUrl
        });

        if (response.ok) {
          monitor.mark('success');
        }
        break;
      }

      if (response.status >= 400 && response.status < 500) {
        monitor.mark('client_error');
        break;
      }

      attempts++;
      if (attempts < config.MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, config.RETRY_DELAY_MS * attempts));
      }
    } catch (error) {
      attempts++;
      if (error instanceof Error && error.name === 'AbortError') {
        response = createErrorResponse('Request timeout', 408);
        responseGeneratedLocally = true;
        break;
      }

      if (attempts >= config.MAX_RETRIES) {
        response = createErrorResponse('Upstream request failed', 502);
        responseGeneratedLocally = true;
        break;
      }

      await new Promise(resolve => setTimeout(resolve, config.RETRY_DELAY_MS * attempts));
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  if (!response) {
    response = createErrorResponse('No response received after all retry attempts', 500);
    responseGeneratedLocally = true;
  }

  return { response, responseGeneratedLocally };
}
