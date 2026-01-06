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
  // Infer scope from the request path for container registry requests
  let scope = '';
  const pathParts = url.pathname.split('/');
  
  // Check for catalog endpoint
  if (pathParts.includes('_catalog')) {
    return 'registry:catalog:*';
  }

  if (pathParts.length >= 4 && pathParts[1] === 'v2') {
    const platformPrefix = `/${platform.replace(/-/g, '/')}/`;
    if (effectivePath.startsWith(platformPrefix)) {
      const repoPathFull = effectivePath.slice(platformPrefix.length);
      const repoParts = repoPathFull.split('/');
      if (repoParts.length >= 1) {
        // Remove /manifests/tag or /blobs/sha suffix to get repo name
        // Common suffixes in v2 API: /manifests/, /blobs/, /tags/
        const suffixIndex = repoParts.findIndex(p => 
          ['manifests', 'blobs', 'tags', 'referrers'].includes(p)
        );
        
        let repoName = suffixIndex !== -1 
          ? repoParts.slice(0, suffixIndex).join('/') 
          : repoParts.join('/');

        if (platform === 'cr-docker' && repoName && !repoName.includes('/')) {
          repoName = `library/${repoName}`;
        }

        if (repoName) {
          scope = `repository:${repoName}:pull`;
        }
      }
    }
  }
  return scope;
}

/**
 * Creates an unauthorized (401) response for container registry authentication.
 *
 * Generates a Docker/OCI registry-compliant 401 response with a WWW-Authenticate
 * header that directs clients to the token authentication endpoint.
 * @param {URL} url - Request URL used to construct authentication realm
 * @param {URL} url - Request URL used to construct authentication realm
 * @returns {Response} Unauthorized response with WWW-Authenticate header
 */
export function responseUnauthorized(url) {
  const headers = new Headers();
  headers.set('WWW-Authenticate', `Bearer realm="https://${url.hostname}/v2/auth",service="Xget"`);
  return new Response(JSON.stringify({ 
    errors: [{
      code: 'UNAUTHORIZED',
      message: 'authentication required',
      detail: null
    }]
  }), {
    status: 401,
    headers
  });
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
  const scope = url.searchParams.get('scope');
  if (!scope) {
    return createErrorResponse('Missing scope parameter', 400);
  }

  // Parse scope to find the target platform and repository
  // Format: repository:cr/docker/library/ubuntu:pull
  // We need to extract 'cr/docker' as the platform
  const parts = scope.split(':');
  if (parts.length < 3 || parts[0] !== 'repository') {
    // If not a repository scope, or invalid format, we can't easily proxy it
    return createErrorResponse('Invalid scope format', 400);
  }

  const [, fullRepoPath] = parts; // e.g., cr/docker/library/ubuntu
  let platformKey = '';
  let repoPath = '';

  // Find the platform from the start of the repo path
  // Try to match 'cr/docker', 'cr/ghcr', etc.
  // We need to find which platform prefix matches the start of fullRepoPath
  // Uses global SORTED_PLATFORMS which is imported

  for (const key of SORTED_PLATFORMS) {
    if (!key.startsWith('cr-')) continue;

    // Convert key cr-docker to cr/docker for matching
    const prefix = key.replace(/-/g, '/');
    if (fullRepoPath.startsWith(`${prefix}/`)) {
      platformKey = key;
      repoPath = fullRepoPath.slice(prefix.length + 1); // +1 for the slash
      break;
    }
  }

  if (!platformKey || !config.PLATFORMS[platformKey]) {
    return createErrorResponse('Unsupported registry platform in scope', 400);
  }

  const upstreamUrl = config.PLATFORMS[platformKey];
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

  // 2. Construct the new scope for the upstream registry
  // We replace our prefixed path with the actual repo path
  // e.g. repository:cr/docker/library/ubuntu:pull -> repository:library/ubuntu:pull

  // However, we also need to respect the service name if possible,
  // but usually we just need to fix the repository part of the scope.
  const newScope = `repository:${repoPath}:${parts.slice(2).join(':')}`;

  // 3. Fetch the token from the upstream realm
  return await fetchToken(wwwAuthenticate, newScope, authorization || '');
}
