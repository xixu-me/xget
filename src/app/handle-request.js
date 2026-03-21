/**
 * Xget - High-performance acceleration engine for developer resources
 * Copyright (C) Xi Xu
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { handleDockerAuth } from '../protocols/docker.js';
import { finalizeResponse } from '../response/finalize-response.js';
import {
  createHomepageRedirect,
  normalizeEffectivePath,
  resolveTarget
} from '../routing/resolve-target.js';
import { getDefaultCache, tryReadCachedResponse } from '../upstream/cache.js';
import { fetchUpstreamResponse } from '../upstream/fetch-upstream.js';
import { PerformanceMonitor, addPerformanceHeaders } from '../utils/performance.js';
import { addCorsHeaders, addSecurityHeaders, createErrorResponse } from '../utils/security.js';
import { getAllowedMethods, isProtocolRequest, validateRequest } from '../utils/validation.js';
import { createRequestContext } from './request-context.js';

/**
 * Main request handler with comprehensive caching, retry logic, and security measures.
 * @param {Request} request - The incoming HTTP request
 * @param {Record<string, unknown>} env - Cloudflare Workers environment variables for runtime config overrides
 * @param {ExecutionContext} ctx - Cloudflare Workers execution context for background tasks
 * @returns {Promise<Response>} The HTTP response with appropriate headers and body
 */
export async function handleRequest(request, env, ctx) {
  let response;
  const monitor = new PerformanceMonitor();
  const requestContext = createRequestContext(request, env);
  const { config, isCorsPreflight, isDocker, url } = requestContext;

  try {
    if (isCorsPreflight) {
      const requestedMethod = request.headers.get('Access-Control-Request-Method') || '';
      const allowedMethods = getAllowedMethods(
        new Request(request.url, { method: requestedMethod || 'GET' }),
        url,
        config
      );

      if (!allowedMethods.includes(requestedMethod)) {
        response = createErrorResponse('Method not allowed', 405);
      } else {
        const headers = addCorsHeaders(new Headers(), request, config);
        if (!headers.has('Access-Control-Allow-Origin')) {
          response = createErrorResponse('Origin not allowed', 403);
        } else {
          headers.set('Access-Control-Allow-Methods', allowedMethods.join(', '));
          headers.set('Access-Control-Max-Age', '86400');
          addSecurityHeaders(headers);
          response = new Response(null, { status: 204, headers });
        }
      }
    }

    // Handle Docker API version check
    else if (isDocker && (url.pathname === '/v2/' || url.pathname === '/v2')) {
      const headers = new Headers({
        'Docker-Distribution-Api-Version': 'registry/2.0',
        'Content-Type': 'application/json'
      });
      addSecurityHeaders(headers);
      response = new Response('{}', { status: 200, headers });
    }
    // Redirect root path or invalid platforms to GitHub repository
    else if (url.pathname === '/' || url.pathname === '') {
      response = createHomepageRedirect();
    } else {
      const validation = validateRequest(request, url, config, requestContext);
      if (!validation.valid) {
        response = createErrorResponse(
          validation.error || 'Validation failed',
          validation.status || 400
        );
      } else {
        const normalizedPath = normalizeEffectivePath(url, isDocker);
        let effectivePath = url.pathname;

        if ('response' in normalizedPath) {
          const { response: normalizedResponse } = normalizedPath;
          response = normalizedResponse;
        } else {
          const { effectivePath: normalizedEffectivePath } = normalizedPath;
          effectivePath = normalizedEffectivePath;
        }

        if (!response) {
          // Handle Docker authentication explicitly
          if (
            isDocker &&
            (url.pathname === '/v2/auth' || /^\/cr\/[^/]+\/v2\/auth\/?$/.test(url.pathname))
          ) {
            response = await handleDockerAuth(request, url, config);
          } else {
            const resolvedTarget = resolveTarget(url, effectivePath, config.PLATFORMS);

            if ('response' in resolvedTarget) {
              const { response: targetResponse } = resolvedTarget;
              response = targetResponse;
            } else {
              const { cacheTargetUrl, platform, targetUrl } = resolvedTarget;
              const authorization = request.headers.get('Authorization');
              const hasSensitiveHeaders = Boolean(
                authorization ||
                request.headers.get('Cookie') ||
                request.headers.get('Proxy-Authorization')
              );
              const canUseCache = request.method === 'GET' || request.method === 'HEAD';
              const shouldPassthroughRequest = isProtocolRequest(requestContext) || !canUseCache;
              const cache = getDefaultCache();

              response = await tryReadCachedResponse({
                cache,
                cacheTargetUrl,
                canUseCache,
                hasSensitiveHeaders,
                monitor,
                request,
                requestContext
              });

              if (!response) {
                const {
                  response: upstreamResponse,
                  responseGeneratedLocally: upstreamResponseGeneratedLocally
                } = await fetchUpstreamResponse({
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
                });
                response = await finalizeResponse({
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
                  response: upstreamResponse,
                  responseGeneratedLocally: upstreamResponseGeneratedLocally,
                  url
                });
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error handling request:', error);
    response = createErrorResponse('Internal Server Error', 500);
  }

  // Ensure performance headers are added to the final response
  monitor.mark('complete');

  const responseWithCors = (() => {
    const headers = addCorsHeaders(new Headers(response.headers), request, config);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  })();

  return isProtocolRequest(requestContext)
    ? responseWithCors
    : addPerformanceHeaders(responseWithCors, monitor);
}
