/**
 * Xget - High-performance acceleration engine for developer resources
 * Copyright (C) 2025 Xi Xu
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Docker/OCI Registry protocol handler for Xget
 */

import { SORTED_PLATFORMS } from '../config/platforms.js';
import { createErrorResponse } from '../utils/security.js';

/**
 * Parses Docker/OCI registry WWW-Authenticate header.
 *
 * Extracts authentication realm and service information from the Bearer
 * authentication challenge header returned by container registries.
 * @param {string} authenticateStr - The WWW-Authenticate header value
 * @returns {{realm: string, service: string}} Parsed authentication info with realm URL and service name
 * @throws {Error} If the header format is invalid or missing required fields
 */
export function parseAuthenticate(authenticateStr) {
  // sample: Bearer realm="https://auth.ipv6.docker.com/token",service="registry.docker.io"
  const realmMatch = authenticateStr.match(/realm="([^"]+)"/);
  const serviceMatch = authenticateStr.match(/service="([^"]+)"/);

  if (!realmMatch || !serviceMatch) {
    throw new Error(`invalid Www-Authenticate Header: ${authenticateStr}`);
  }

  return {
    realm: realmMatch[1],
    service: serviceMatch[1]
  };
}

/**
 * Fetches authentication token from container registry token service.
 *
 * Requests a Bearer token from the registry's authentication service,
 * optionally including scope (repository permissions) and authorization credentials.
 * @param {{realm: string, service: string}} wwwAuthenticate - Authentication info from WWW-Authenticate header
 * @param {string} scope - The scope for the token (e.g., "repository:library/nginx:pull")
 * @param {string} authorization - Authorization header value (optional, for authenticated access)
 * @returns {Promise<Response>} Token response containing JWT token
 */
export async function fetchToken(wwwAuthenticate, scope, authorization) {
  const url = new URL(wwwAuthenticate.realm);
  if (wwwAuthenticate.service.length) {
    url.searchParams.set('service', wwwAuthenticate.service);
  }
  if (scope) {
    url.searchParams.set('scope', scope);
  }
  const headers = new Headers();
  if (authorization) {
    headers.set('Authorization', authorization);
  }
  return await fetch(url, { method: 'GET', headers });
}

/**
 * Parses the request URL to determine the appropriate Docker registry scope.
 *
 * Analyzes the path to extract the repository name and constructs a standard
 * Docker scope string (repository:name:pull). Handles platform-specific
 * path conventions and defaults.
 * @param {URL} url - The request URL
 * @param {string} effectivePath - The effective path after stripping prefixes
 * @param {string} platform - The platform identifier (e.g., 'cr-docker')
 * @returns {string} One of:
 *   - "repository:name:pull" for repository access
 *   - "registry:catalog:*" for catalog access
 *   - "" (empty string) if scope cannot be determined
 */
export function getScopeFromUrl(url, effectivePath, platform) {
  void url;
  const platformPrefix = `/${platform.replace(/-/g, '/')}/`;

  // Check for catalog endpoint
  if (effectivePath.includes('/_catalog')) {
    return 'registry:catalog:*';
  }

  const apiPath = normalizeRegistryApiPath(
    platform,
    effectivePath.startsWith(platformPrefix)
      ? `/${effectivePath.slice(platformPrefix.length)}`
      : effectivePath
  );
  const repoName = extractRepositoryPath(apiPath);

  if (repoName) {
    return `repository:${repoName}:pull`;
  }

  return '';
}

/**
 * Normalizes Docker Hub official images to the canonical library namespace.
 * @param {string} platformKey
 * @param {string} repoPath
 * @returns {string} Normalized upstream repository path.
 */
function normalizeRepoPath(platformKey, repoPath) {
  if (platformKey === 'cr-docker' && repoPath && !repoPath.includes('/')) {
    return `library/${repoPath}`;
  }

  return repoPath;
}

/**
 * Extracts the repository path from a Docker registry API path.
 * @param {string} apiPath
 * @returns {string} Repository path without the `/v2/` prefix or operation suffix.
 */
function extractRepositoryPath(apiPath) {
  const normalizedPath = apiPath.startsWith('/v2/')
    ? apiPath.slice(4)
    : apiPath.replace(/^\/+/, '');
  const pathParts = normalizedPath.split('/').filter(Boolean);

  if (pathParts.length === 0 || pathParts[0].startsWith('_')) {
    return '';
  }

  const suffixIndex = pathParts.findIndex(part =>
    ['manifests', 'blobs', 'tags', 'referrers'].includes(part)
  );

  if (suffixIndex <= 0) {
    return '';
  }

  return pathParts.slice(0, suffixIndex).join('/');
}

/**
 * Normalizes a Docker registry API path for upstream compatibility.
 * @param {string} platformKey
 * @param {string} apiPath
 * @returns {string} Upstream API path with any registry-specific normalization applied.
 */
export function normalizeRegistryApiPath(platformKey, apiPath) {
  if (platformKey !== 'cr-docker' || !apiPath.startsWith('/v2/')) {
    return apiPath;
  }

  const repoPath = extractRepositoryPath(apiPath);
  const normalizedRepoPath = normalizeRepoPath(platformKey, repoPath);

  if (!repoPath || normalizedRepoPath === repoPath) {
    return apiPath;
  }

  return apiPath.replace(`/v2/${repoPath}`, `/v2/${normalizedRepoPath}`);
}

/**
 * Resolves the target registry and scope for Docker auth proxy requests.
 * @param {URL} url
 * @param {{ [key: string]: string }} platforms
 * @returns {{ platformKey: string, upstreamScope: string }} Resolved auth target info.
 */
function resolveDockerAuthTarget(url, platforms) {
  const scope = url.searchParams.get('scope') || '';
  const pathMatch = url.pathname.match(/^\/cr\/([^/]+)\/v2\/auth\/?$/);

  let platformKey = pathMatch ? `cr-${pathMatch[1]}` : '';
  let repoPath = '';
  let upstreamScope = scope;

  if (scope) {
    const parts = scope.split(':');
    if (parts.length >= 3 && parts[0] === 'repository') {
      const [, fullRepoPath] = parts;

      if (fullRepoPath.startsWith('cr/')) {
        for (const key of SORTED_PLATFORMS) {
          if (!key.startsWith('cr-')) continue;

          const prefix = key.replace(/-/g, '/');
          if (fullRepoPath.startsWith(`${prefix}/`)) {
            platformKey = key;
            repoPath = fullRepoPath.slice(prefix.length + 1);
            break;
          }
        }
      } else {
        repoPath = fullRepoPath;
      }

      repoPath = normalizeRepoPath(platformKey, repoPath);
      upstreamScope = repoPath ? `repository:${repoPath}:${parts.slice(2).join(':')}` : scope;
    }
  }

  if (!platformKey || !platforms[platformKey]) {
    throw new Error('Unsupported registry platform in scope');
  }

  return { platformKey, upstreamScope };
}

/**
 * Creates an unauthorized (401) response for container registry authentication.
 *
 * Generates a Docker/OCI registry-compliant 401 response with a WWW-Authenticate
 * header that directs clients to the token authentication endpoint.
 * @param {URL} url - Request URL used to construct authentication realm
 * @param {string} platform - Registry platform key (e.g. cr-ghcr)
 * @returns {Response} Unauthorized response with WWW-Authenticate header
 */
export function responseUnauthorized(url, platform) {
  const realmPath = platform ? `/cr/${platform.slice(3)}/v2/auth` : '/v2/auth';
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('WWW-Authenticate', `Bearer realm="${url.origin}${realmPath}",service="Xget"`);
  return new Response(
    JSON.stringify({
      errors: [
        {
          code: 'UNAUTHORIZED',
          message: 'authentication required',
          detail: null
        }
      ]
    }),
    {
      status: 401,
      headers
    }
  );
}

/**
 * Handles the special /v2/auth endpoint for Docker authentication.
 *
 * Proxies generation of auth tokens by negotiating with the upstream registry.
 * @param {Request} request - The incoming request
 * @param {URL} url - The parsed URL
 * @param {import('../config/index.js').ApplicationConfig} config - App configuration
 * @returns {Promise<Response>} The response (token or error)
 */
export async function handleDockerAuth(request, url, config) {
  let target;
  try {
    target = resolveDockerAuthTarget(url, config.PLATFORMS);
  } catch (error) {
    // Log internal error details server-side without exposing them to the client
    console.error('Failed to resolve Docker auth target:', error);
    // Return a generic error response to avoid leaking implementation details
    return createErrorResponse('Invalid Docker authentication request', 400);
  }

  const upstreamUrl = config.PLATFORMS[target.platformKey];
  const authorization = request.headers.get('Authorization');

  // 1. Fetch the upstream root (v2) to get the proper realm and service
  // We use the upstream URL + /v2/
  const v2Url = new URL(`${upstreamUrl}/v2/`);
  const v2Resp = await fetch(v2Url.toString(), {
    method: 'GET',
    redirect: 'follow'
  });

  if (v2Resp.status !== 401) {
    // If not 401, maybe no auth needed? Or error.
    // Just forward the response?
    return v2Resp;
  }

  const authenticateStr = v2Resp.headers.get('WWW-Authenticate');
  if (authenticateStr === null) {
    return v2Resp;
  }

  const wwwAuthenticate = parseAuthenticate(authenticateStr);

  // 3. Fetch the token from the upstream realm
  return await fetchToken(wwwAuthenticate, target.upstreamScope, authorization || '');
}
