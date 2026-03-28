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
 * Request validation utilities for Xget
 */

import { CONFIG } from '../config/index.js';

// Imported protocol checks
import { isAIInferenceRequest } from '../protocols/ai.js';
import { isGitLFSRequest, isGitRequest } from '../protocols/git.js';
import { isHuggingFaceAPIRequest } from '../protocols/huggingface.js';

/**
 * Computes protocol and request traits used across validation, routing, and response handling.
 * @param {Request} request
 * @param {URL} url
 * @returns {{
 *   isAI: boolean,
 *   isDocker: boolean,
 *   isGit: boolean,
 *   isGitLFS: boolean,
 *   isHF: boolean
 * }} Request traits for the current request.
 */
export function getRequestTraits(request, url) {
  return {
    isAI: isAIInferenceRequest(request, url),
    isDocker: isDockerRequest(request, url),
    isGit: isGitRequest(request, url),
    isGitLFS: isGitLFSRequest(request, url),
    isHF: isHuggingFaceAPIRequest(request, url)
  };
}

/**
 * Checks whether a request should use protocol passthrough behavior.
 * @param {{
 *   isAI: boolean,
 *   isDocker: boolean,
 *   isGit: boolean,
 *   isGitLFS: boolean,
 *   isHF: boolean
 * }} traits
 * @returns {boolean} True when request handling should follow protocol passthrough rules.
 */
export function isProtocolRequest(traits) {
  return traits.isGit || traits.isGitLFS || traits.isDocker || traits.isAI || traits.isHF;
}

/**
 * Best-effort decode for security validation.
 *
 * URL.pathname may keep some reserved characters percent-encoded (e.g. %2F).
 * We decode a couple of times to catch traversal attempts like %2e%2e%2f.
 * @param {string} pathname
 * @returns {{ok: true, value: string} | {ok: false}} Decoded path result
 */
function decodePathnameForValidation(pathname) {
  let decoded = pathname;
  for (let i = 0; i < 2; i++) {
    if (!/%[0-9a-fA-F]{2}/.test(decoded)) {
      break;
    }
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      return { ok: false };
    }
  }
  return { ok: true, value: decoded };
}

/**
 * Detects directory traversal patterns in a URL path.
 * @param {string} pathname
 * @returns {boolean} True if traversal is detected
 */
function hasPathTraversal(pathname) {
  const decodedResult = decodePathnameForValidation(pathname);
  if (!decodedResult.ok) {
    return true;
  }

  const decoded = decodedResult.value.replace(/\\/g, '/');
  return /(^|\/)\.\.(\/|$)/.test(decoded);
}

/**
 * Checks for ASCII control characters.
 * @param {string} value
 * @returns {boolean} True if ASCII control chars are present
 */
function hasAsciiControlChars(value) {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 31 || code === 127) {
      return true;
    }
  }
  return false;
}

/**
 * Detects if a request is a container registry operation (Docker/OCI).
 *
 * Identifies Docker and OCI registry requests by checking for:
 * - Registry API endpoints (/v2/...)
 * - Docker-specific User-Agent headers
 * - Docker/OCI manifest Accept headers
 * @param {Request} request - The incoming request object
 * @param {URL} url - Parsed URL object
 * @returns {boolean} True if this is a container registry operation
 */
export function isDockerRequest(request, url) {
  const { pathname } = url;

  // Check for container registry API endpoints
  if (pathname === '/v2' || pathname === '/v2/' || pathname.startsWith('/v2/')) {
    return true;
  }

  if (pathname.startsWith('/cr/')) {
    if (/^\/cr\/[^/]+\/v2(?:\/|$)/.test(pathname)) {
      return true;
    }

    const userAgent = request.headers.get('User-Agent') || '';
    if (userAgent.toLowerCase().includes('docker/')) {
      return true;
    }

    const accept = request.headers.get('Accept') || '';
    if (
      accept.includes('application/vnd.docker.distribution.manifest') ||
      accept.includes('application/vnd.oci.image.manifest') ||
      accept.includes('application/vnd.docker.image.rootfs.diff.tar.gzip')
    ) {
      return true;
    }

    const contentType = request.headers.get('Content-Type') || '';
    if (
      contentType.includes('application/vnd.docker.distribution.manifest') ||
      contentType.includes('application/vnd.oci.image.manifest')
    ) {
      return true;
    }
  }

  return false;
}

// Re-export for standard usage
export { isAIInferenceRequest, isGitLFSRequest, isGitRequest, isHuggingFaceAPIRequest };

/**
 * Computes the allowed methods for a request based on protocol detection.
 * @param {Request} request
 * @param {URL} url
 * @param {import('../config/index.js').ApplicationConfig} config
 * @returns {string[]} Allowed HTTP methods for this request shape.
 */
export function getAllowedMethods(request, url, config = CONFIG) {
  const traits = getRequestTraits(request, url);

  return isProtocolRequest(traits)
    ? ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']
    : config.SECURITY.ALLOWED_METHODS;
}

/**
 * Validates incoming requests against security rules.
 *
 * Performs security validation including:
 * - HTTP method validation (with special allowances for protocol-specific operations)
 * - URL path length limits
 *
 * Different protocols have different allowed methods:
 * - Regular requests: GET, HEAD (configurable via SECURITY.ALLOWED_METHODS)
 * - Git/LFS/Docker/AI/Hugging Face API: GET, HEAD, POST, PUT, PATCH, DELETE
 * @param {Request} request - The incoming request object
 * @param {URL} url - Parsed URL object
 * @param {import('../config/index.js').ApplicationConfig} config - Configuration object
 * @param {{
 *   isAI: boolean,
 *   isDocker: boolean,
 *   isGit: boolean,
 *   isGitLFS: boolean,
 *   isHF: boolean
 * }} traits - Pre-computed request traits to avoid repeated protocol detection.
 * @returns {{valid: boolean, error?: string, status?: number}} Validation result object
 */
export function validateRequest(
  request,
  url,
  config = CONFIG,
  traits = getRequestTraits(request, url)
) {
  const allowedMethods = isProtocolRequest(traits)
    ? ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']
    : config.SECURITY.ALLOWED_METHODS;

  if (!allowedMethods.includes(request.method)) {
    return { valid: false, error: 'Method not allowed', status: 405 };
  }

  if (url.pathname.length > config.SECURITY.MAX_PATH_LENGTH) {
    return { valid: false, error: 'Path too long', status: 414 };
  }

  // Reject obvious traversal in the raw URL path (before URL normalization).
  // Some runtimes normalize `..` segments when parsing URL.pathname.
  const rawPathname = request.url.startsWith(url.origin)
    ? request.url.slice(url.origin.length).split('?')[0].split('#')[0].replace(/\\/g, '/')
    : url.pathname;

  if (/(^|\/)\.\.(\/|$)/.test(rawPathname)) {
    return { valid: false, error: 'Invalid path', status: 400 };
  }

  // Reject control characters and directory traversal attempts.
  // This protects both our routing logic and upstream requests.
  if (hasAsciiControlChars(url.pathname)) {
    return { valid: false, error: 'Invalid path', status: 400 };
  }

  if (hasPathTraversal(url.pathname)) {
    return { valid: false, error: 'Invalid path', status: 400 };
  }

  return { valid: true };
}
