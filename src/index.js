/**
 * Xget - High-performance acceleration engine for developer resources
 * Copyright (C) 2025 Xi Xu
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { CONFIG, createConfig } from './config/index.js';
import { SORTED_PLATFORMS, transformPath } from './config/platforms.js';
import { configureAIHeaders, isAIInferenceRequest } from './protocols/ai.js';
import { configureHuggingFaceHeaders, isHuggingFaceAPIRequest } from './protocols/huggingface.js';
import {
  fetchToken,
  getScopeFromUrl,
  handleDockerAuth,
  parseAuthenticate,
  responseUnauthorized
} from './protocols/docker.js';
import { configureGitHeaders, isGitLFSRequest, isGitRequest } from './protocols/git.js';
import { PerformanceMonitor, addPerformanceHeaders } from './utils/performance.js';
import { addSecurityHeaders, createErrorResponse } from './utils/security.js';
import { isDockerRequest, validateRequest } from './utils/validation.js';

/**
 * Main request handler with comprehensive caching, retry logic, and security measures.
 * @param {Request} request - The incoming HTTP request
 * @param {Record<string, unknown>} env - Cloudflare Workers environment variables for runtime config overrides
 * @param {ExecutionContext} ctx - Cloudflare Workers execution context for background tasks
 * @returns {Promise<Response>} The HTTP response with appropriate headers and body
 */
async function handleRequest(request, env, ctx) {
  let response;
  const monitor = new PerformanceMonitor();

  try {
    // Create config with environment variable overrides
    const config = env ? createConfig(env) : CONFIG;
    const url = new URL(request.url);
    const isDocker = isDockerRequest(request, url);

    // Handle Docker API version check
    if (isDocker && (url.pathname === '/v2/' || url.pathname === '/v2')) {
      const headers = new Headers({
        'Docker-Distribution-Api-Version': 'registry/2.0',
        'Content-Type': 'application/json'
      });
      addSecurityHeaders(headers);
      response = new Response('{}', { status: 200, headers });
    }
    // Redirect root path or invalid platforms to GitHub repository
    else if (url.pathname === '/' || url.pathname === '') {
      const HOME_PAGE_URL = 'https://github.com/xixu-me/Xget';
      response = Response.redirect(HOME_PAGE_URL, 302);
    } else {
      const validation = validateRequest(request, url, config);
      if (!validation.valid) {
        response = createErrorResponse(
          validation.error || 'Validation failed',
          validation.status || 400
        );
      } else {
        // Parse platform and path
        let effectivePath = url.pathname;

        // Handle container registry paths specially
        if (isDocker) {
          // For Docker requests, check if they have /cr/ prefix
          // but allow /v2/auth which handles authentication
          if (
            !url.pathname.startsWith('/cr/') &&
            !url.pathname.startsWith('/v2/cr/') &&
            url.pathname !== '/v2/auth'
          ) {
            response = createErrorResponse('container registry requests must use /cr/ prefix', 400);
          } else {
            // Remove /v2 from the path for container registry API consistency if present
            effectivePath = url.pathname.replace(/^\/v2/, '');
          }
        }

        if (!response) {
          // Handle Docker authentication explicitly
          if (isDocker && url.pathname === '/v2/auth') {
            response = await handleDockerAuth(request, url, config);
          } else {
            // Platform detection using transform patterns
            // Use pre-computed sorted platforms
            const platform =
              SORTED_PLATFORMS.find(key => {
                const expectedPrefix = `/${key.replace('-', '/')}/`;
                return effectivePath.startsWith(expectedPrefix);
              }) || effectivePath.split('/')[1];

            if (!platform || !config.PLATFORMS[platform]) {
              const HOME_PAGE_URL = 'https://github.com/xixu-me/Xget';
              response = Response.redirect(HOME_PAGE_URL, 302);
            } else {
              // Check if the path only contains the platform prefix without any actual resource path
              const platformPath = `/${platform.replace(/-/g, '/')}`;
              if (effectivePath === platformPath || effectivePath === `${platformPath}/`) {
                const HOME_PAGE_URL = 'https://github.com/xixu-me/Xget';
                response = Response.redirect(HOME_PAGE_URL, 302);
              } else {
                // Transform URL based on platform using unified logic
                const targetPath = transformPath(effectivePath, platform);

                // For container registries, ensure we add the /v2 prefix for the Docker API
                let finalTargetPath;
                if (platform.startsWith('cr-')) {
                  finalTargetPath = `/v2${targetPath}`;
                } else {
                  finalTargetPath = targetPath;
                }

                const targetUrl = `${config.PLATFORMS[platform]}${finalTargetPath}${url.search}`;
                const authorization = request.headers.get('Authorization');
                const hasSensitiveHeaders = Boolean(
                  authorization ||
                  request.headers.get('Cookie') ||
                  request.headers.get('Proxy-Authorization')
                );

                // Check if this is a Git operation
                const isGit = isGitRequest(request, url);

                // Check if this is a Git LFS operation
                const isGitLFS = isGitLFSRequest(request, url);

                // Check if this is an AI inference request
                const isAI = isAIInferenceRequest(request, url);

                // Check if this is a Hugging Face API request
                const isHF = isHuggingFaceAPIRequest(request, url);

                // Check cache first (skip cache for Git, Git LFS, Docker, AI inference, and HF API operations)
                /** @type {Cache | null} */
                // @ts-ignore - Cloudflare Workers cache API
                const cache =
                  typeof caches !== 'undefined' && /** @type {any} */ (caches).default // eslint-disable-line jsdoc/reject-any-type
                    ? /** @type {any} */ (caches).default // eslint-disable-line jsdoc/reject-any-type
                    : null;

                if (
                  cache &&
                  !isGit &&
                  !isGitLFS &&
                  !isDocker &&
                  !isAI &&
                  !isHF &&
                  !hasSensitiveHeaders
                ) {
                  try {
                    // For Range requests, try cache match first
                    const cacheKey = new Request(targetUrl, {
                      method: 'GET',
                      headers: request.headers
                    });
                    const cachedResponse = await cache.match(cacheKey);
                    if (cachedResponse) {
                      monitor.mark('cache_hit');
                      response = cachedResponse;
                    } else {
                      // If Range request missed cache, try with original request to see if we have full content cached
                      const rangeHeader = request.headers.get('Range');
                      if (rangeHeader) {
                        const fullContentKey = new Request(targetUrl, {
                          method: 'GET', // Always use GET method for cache key consistency
                          headers: new Headers(
                            [...request.headers.entries()].filter(
                              ([k]) => k.toLowerCase() !== 'range'
                            )
                          )
                        });
                        const fullCachedResponse = await cache.match(fullContentKey);
                        if (fullCachedResponse) {
                          monitor.mark('cache_hit_full_content');
                          response = fullCachedResponse;
                        }
                      }
                    }
                  } catch (cacheError) {
                    console.warn('Cache API unavailable:', cacheError);
                  }
                }

                if (!response) {
                  /** @type {RequestInit} */
                  const fetchOptions = {
                    method: request.method,
                    headers: new Headers(),
                    redirect: 'follow'
                  };

                  // Add body for POST/PUT/PATCH/DELETE requests (Git/Docker/AI/HF operations)
                  if (
                    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) &&
                    (isGit || isGitLFS || isDocker || isAI || isHF)
                  ) {
                    fetchOptions.body = request.body;
                  }

                  // Cast headers to Headers for proper typing
                  const requestHeaders = /** @type {Headers} */ (fetchOptions.headers);

                  // Set appropriate headers for Git/Docker/AI/HF vs regular requests
                  if (isGit || isGitLFS || isDocker || isAI || isHF) {
                    // For Git/Docker/AI/HF operations, copy all headers from the original request
                    // This ensures protocol compliance
                    for (const [key, value] of request.headers.entries()) {
                      // Skip headers that might cause issues with proxying
                      if (
                        !['host', 'connection', 'upgrade', 'proxy-connection'].includes(
                          key.toLowerCase()
                        )
                      ) {
                        requestHeaders.set(key, value);
                      }
                    }

                    // Configure protocol-specific headers using modular helpers
                    configureGitHeaders(requestHeaders, request, url, isGitLFS);

                    if (isAI) {
                      configureAIHeaders(requestHeaders, request);
                    }

                    if (isHF) {
                      configureHuggingFaceHeaders(requestHeaders, request);
                    }
                  } else {
                    // Regular file download headers
                    Object.assign(fetchOptions, {
                      cf: {
                        http3: true,
                        cacheTtl: config.CACHE_DURATION,
                        cacheEverything: true,
                        minify: {
                          javascript: true,
                          css: true,
                          html: true
                        },
                        preconnect: true
                      }
                    });

                    requestHeaders.set('Accept-Encoding', 'gzip, deflate, br');
                    requestHeaders.set('Connection', 'keep-alive');
                    requestHeaders.set('User-Agent', 'Wget/1.21.3');
                    requestHeaders.set('Origin', request.headers.get('Origin') || '*');

                    if (authorization) {
                      requestHeaders.set('Authorization', authorization);
                    }

                    const rangeHeader = request.headers.get('Range');
                    const isMediaFile = targetUrl.match(
                      /\.(mp4|avi|mkv|mov|wmv|flv|webm|mp3|wav|flac|aac|ogg|jpg|jpeg|png|gif|bmp|svg|pdf|zip|rar|7z|tar|gz|bz2|xz)$/i
                    );

                    if (isMediaFile || rangeHeader) {
                      requestHeaders.set('Accept-Encoding', 'identity');
                    }

                    if (rangeHeader) {
                      requestHeaders.set('Range', rangeHeader);
                    }
                  }

                  // Implement retry mechanism
                  let attempts = 0;
                  while (attempts < config.MAX_RETRIES) {
                    try {
                      monitor.mark(`attempt_${attempts}`);

                      const controller = new AbortController();
                      const timeoutId = setTimeout(
                        () => controller.abort(),
                        config.TIMEOUT_SECONDS * 1000
                      );

                      const finalFetchOptions = {
                        ...fetchOptions,
                        signal: controller.signal
                      };

                      // Special handling for Docker redirects to avoid leaking Auth headers to S3 (blobs)
                      if (isDocker) {
                        finalFetchOptions.redirect = 'manual';
                      }

                      // Special handling for HEAD requests to ensure Content-Length header
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

                      clearTimeout(timeoutId);

                      // Handle manual redirect for Docker
                      if (
                        isDocker &&
                        (response.status === 301 ||
                          response.status === 302 ||
                          response.status === 307)
                      ) {
                        const location = response.headers.get('Location');
                        if (location) {
                          // Fetch the new location without Authorization header
                          // Cloudflare Workers fetch should follow this automatically if we used 'follow',
                          // but we used 'manual' to strip headers.
                          const redirectHeaders = new Headers(finalFetchOptions.headers);
                          redirectHeaders.delete('Authorization');

                          response = await fetch(location, {
                            ...finalFetchOptions,
                            headers: redirectHeaders,
                            redirect: 'follow' // Follow subsequent redirects normally
                          });
                        }
                      }

                      if (response.ok || response.status === 206) {
                        monitor.mark('success');
                        break;
                      }

                      // For container registry, handle authentication challenges more intelligently
                      if (isDocker && response.status === 401) {
                        monitor.mark('docker_auth_challenge');

                        const authenticateStr = response.headers.get('WWW-Authenticate');

                        // Calculate scope for upstream token fetch
                        const scope = getScopeFromUrl(url, effectivePath, platform);

                        if (authenticateStr) {
                          try {
                            const wwwAuthenticate = parseAuthenticate(authenticateStr);

                            // Try to get a token for public access (without authorization)
                            const tokenResponse = await fetchToken(
                              wwwAuthenticate,
                              scope || '',
                              ''
                            );

                            if (tokenResponse.ok) {
                              const tokenData = await tokenResponse.json();
                              if (tokenData.token) {
                                const retryHeaders = new Headers(requestHeaders);
                                retryHeaders.set('Authorization', `Bearer ${tokenData.token}`);

                                const retryOptions = {
                                  ...finalFetchOptions,
                                  headers: retryHeaders
                                };

                                // Also use manual redirect for retry
                                if (isDocker) {
                                  retryOptions.redirect = 'manual';
                                }

                                let retryResponse = await fetch(targetUrl, retryOptions);

                                // Handle manual redirect for retry
                                if (
                                  isDocker &&
                                  (retryResponse.status === 301 ||
                                    retryResponse.status === 302 ||
                                    retryResponse.status === 307)
                                ) {
                                  const location = retryResponse.headers.get('Location');
                                  if (location) {
                                    const redirectHeaders = new Headers(retryOptions.headers);
                                    redirectHeaders.delete('Authorization');

                                    retryResponse = await fetch(location, {
                                      ...retryOptions,
                                      headers: redirectHeaders,
                                      redirect: 'follow'
                                    });
                                  }
                                }

                                if (retryResponse.ok) {
                                  response = retryResponse;
                                  monitor.mark('success');
                                  break;
                                }
                              }
                            }
                          } catch (error) {
                            console.warn('Token fetch failed:', error);
                          }
                        }

                        response = responseUnauthorized(url);
                        break;
                      }

                      if (response.status >= 400 && response.status < 500) {
                        monitor.mark('client_error');
                        break;
                      }

                      attempts++;
                      if (attempts < config.MAX_RETRIES) {
                        await new Promise(resolve =>
                          setTimeout(resolve, config.RETRY_DELAY_MS * attempts)
                        );
                      }
                    } catch (error) {
                      attempts++;
                      if (error instanceof Error && error.name === 'AbortError') {
                        response = createErrorResponse('Request timeout', 408);
                        break;
                      }
                      if (attempts >= config.MAX_RETRIES) {
                        const message = error instanceof Error ? error.message : String(error);
                        response = createErrorResponse(
                          `Failed after ${config.MAX_RETRIES} attempts: ${message}`,
                          500,
                          true
                        );
                        break;
                      }
                      await new Promise(resolve =>
                        setTimeout(resolve, config.RETRY_DELAY_MS * attempts)
                      );
                    }
                  }

                  if (!response) {
                    response = createErrorResponse(
                      'No response received after all retry attempts',
                      500,
                      true
                    );
                  } else if (!response.ok && response.status !== 206) {
                    if (isDocker && response.status === 401) {
                      // Handle Docker 401 responses that might not have been caught by the retry loop
                      const isCustomError =
                        response.headers.get('content-type') === 'application/json' &&
                        (await response.clone().text()).includes('UNAUTHORIZED');

                      if (!isCustomError) {
                        const errorText = await response.text().catch(() => '');
                        response = createErrorResponse(
                          `Authentication required for this container registry resource. This may be a private repository. Original error: ${errorText}`,
                          401,
                          true
                        );
                      }
                    } else {
                      const errorText = await response.text().catch(() => 'Unknown error');
                      response = createErrorResponse(
                        `Upstream server error (${response.status}): ${errorText}`,
                        response.status,
                        true
                      );
                    }
                  } else {
                    // Success case processing (rewriting URLs etc)
                    let responseBody = response.body;

                    if (
                      platform === 'pypi' &&
                      response.headers.get('content-type')?.includes('text/html')
                    ) {
                      const originalText = await response.text();
                      const rewrittenText = originalText.replace(
                        /https:\/\/files\.pythonhosted\.org/g,
                        `${url.origin}/pypi/files`
                      );
                      responseBody = new ReadableStream({
                        start(controller) {
                          controller.enqueue(new TextEncoder().encode(rewrittenText));
                          controller.close();
                        }
                      });
                    }

                    if (
                      platform === 'npm' &&
                      response.headers.get('content-type')?.includes('application/json')
                    ) {
                      const originalText = await response.text();
                      const rewrittenText = originalText.replace(
                        /https:\/\/registry.npmjs.org\/([^/]+)/g,
                        `${url.origin}/npm/$1`
                      );
                      responseBody = new ReadableStream({
                        start(controller) {
                          controller.enqueue(new TextEncoder().encode(rewrittenText));
                          controller.close();
                        }
                      });
                    }

                    const headers = new Headers(response.headers);

                    if (!isGit && !isGitLFS && !isDocker && !isAI && !isHF) {
                      if (hasSensitiveHeaders) {
                        headers.set('Cache-Control', 'private, no-store');
                        const existingVary = headers.get('Vary');
                        headers.set(
                          'Vary',
                          existingVary
                            ? `${existingVary}, Authorization, Cookie`
                            : 'Authorization, Cookie'
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

                    response = new Response(responseBody, {
                      status: response.status,
                      headers
                    });

                    // Cache success logic
                    if (
                      cache &&
                      !isGit &&
                      !isGitLFS &&
                      !isDocker &&
                      !isAI &&
                      !isHF &&
                      !hasSensitiveHeaders &&
                      request.method === 'GET' &&
                      response.ok &&
                      response.status === 200
                    ) {
                      const rangeHeader = request.headers.get('Range');
                      const cacheKey = rangeHeader
                        ? new Request(targetUrl, {
                            method: 'GET',
                            headers: new Headers(
                              [...request.headers.entries()].filter(
                                ([k]) => k.toLowerCase() !== 'range'
                              )
                            )
                          })
                        : new Request(targetUrl, { method: 'GET' });

                      try {
                        if (ctx && typeof ctx.waitUntil === 'function') {
                          ctx.waitUntil(cache.put(cacheKey, response.clone()));
                        } else {
                          cache.put(cacheKey, response.clone()).catch(error => {
                            console.warn('Cache put failed:', error);
                          });
                        }

                        if (rangeHeader && response.status === 200) {
                          const rangedResponse = await cache.match(
                            new Request(targetUrl, {
                              method: 'GET',
                              headers: request.headers
                            })
                          );
                          if (rangedResponse) {
                            monitor.mark('range_cache_hit_after_full_cache');
                            response = rangedResponse;
                          }
                        }
                      } catch (cacheError) {
                        console.warn('Cache put/match failed:', cacheError);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error handling request:', error);
    const message = error instanceof Error ? error.message : String(error);
    response = createErrorResponse(`Internal Server Error: ${message}`, 500, true);
  }

  // Ensure performance headers are added to the final response
  monitor.mark('complete');
  const isGit = isGitRequest(request, new URL(request.url));
  const isDocker = isDockerRequest(request, new URL(request.url));
  const isAI = isAIInferenceRequest(request, new URL(request.url));
  const isGitLFS = isGitLFSRequest(request, new URL(request.url));
  const isHF = isHuggingFaceAPIRequest(request, new URL(request.url));

  return isGit || isGitLFS || isDocker || isAI || isHF
    ? response
    : addPerformanceHeaders(response, monitor);
}

export { handleRequest };
export default {
  /**
   * Main Worker entry point.
   * @param {Request} request
   * @param {Record<string, unknown>} env
   * @param {ExecutionContext} ctx
   */
  fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  }
};
