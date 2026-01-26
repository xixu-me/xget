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
 * Git protocol handler for Xget
 */

/**
 * Detects if a request is a Git protocol operation.
 *
 * Identifies Git requests by checking for:
 * - Git-specific endpoints (/info/refs, /git-upload-pack, /git-receive-pack)
 * - Git User-Agent headers
 * - Git service query parameters
 * - Git-specific Content-Type headers
 * @param {Request} request - The incoming request object
 * @param {URL} url - Parsed URL object
 * @returns {boolean} True if this is a Git operation
 */
export function isGitRequest(request, url) {
  // Check for Git-specific endpoints
  if (url.pathname.endsWith('/info/refs')) {
    return true;
  }

  if (url.pathname.endsWith('/git-upload-pack') || url.pathname.endsWith('/git-receive-pack')) {
    return true;
  }

  // Check for Git user agents (more comprehensive check)
  const userAgent = request.headers.get('User-Agent') || '';
  if (userAgent.includes('git/') || userAgent.startsWith('git/')) {
    return true;
  }

  // Check for Git-specific query parameters
  if (url.searchParams.has('service')) {
    const service = url.searchParams.get('service');
    return service === 'git-upload-pack' || service === 'git-receive-pack';
  }

  // Check for Git-specific content types
  const contentType = request.headers.get('Content-Type') || '';
  if (contentType.includes('git-upload-pack') || contentType.includes('git-receive-pack')) {
    return true;
  }

  return false;
}

/**
 * Detects if a request is a Git LFS (Large File Storage) operation.
 *
 * Identifies Git LFS requests by checking for:
 * - LFS-specific endpoints (/info/lfs, /objects/batch)
 * - LFS object storage paths (SHA-256 hash patterns)
 * - Git LFS Accept/Content-Type headers
 * - Git LFS User-Agent
 * @param {Request} request - The incoming request object
 * @param {URL} url - Parsed URL object
 * @returns {boolean} True if this is a Git LFS operation
 */
export function isGitLFSRequest(request, url) {
  // Check for LFS-specific endpoints
  if (url.pathname.includes('/info/lfs')) {
    return true;
  }

  if (url.pathname.includes('/objects/batch')) {
    return true;
  }

  // Check for LFS object storage endpoints (SHA-256 hash is 64 hex characters)
  if (url.pathname.match(/\/objects\/[a-fA-F0-9]{64}$/)) {
    return true;
  }

  // Check for LFS-specific headers
  const accept = request.headers.get('Accept') || '';
  const contentType = request.headers.get('Content-Type') || '';

  if (
    accept.includes('application/vnd.git-lfs') ||
    contentType.includes('application/vnd.git-lfs')
  ) {
    return true;
  }

  // Check for LFS user agent
  const userAgent = request.headers.get('User-Agent') || '';
  if (userAgent.includes('git-lfs')) {
    return true;
  }

  return false;
}

/**
 * Configures headers for Git protocol requests.
 *
 * Sets User-Agent and Content-Type headers required by Git and Git LFS protocols.
 * @param {Headers} headers - The headers object to modify
 * @param {Request} request - The original request
 * @param {URL} url - The parsed URL
 * @param {boolean} isLFS - Whether this is an LFS request
 */
export function configureGitHeaders(headers, request, url, isLFS) {
  if (!isLFS) {
    // Standard Git protocol
    if (!headers.has('User-Agent')) {
      headers.set('User-Agent', 'git/2.34.1');
    }

    if (request.method === 'POST' && url.pathname.endsWith('/git-upload-pack')) {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/x-git-upload-pack-request');
      }
    }

    if (request.method === 'POST' && url.pathname.endsWith('/git-receive-pack')) {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/x-git-receive-pack-request');
      }
    }
  } else {
    // Git LFS protocol
    if (!headers.has('User-Agent')) {
      headers.set('User-Agent', 'git-lfs/3.0.0 (GitHub; darwin amd64; go 1.17.2)');
    }
    if (url.pathname.includes('/objects/batch')) {
      if (!headers.has('Accept')) {
        headers.set('Accept', 'application/vnd.git-lfs+json');
      }
      if (request.method === 'POST' && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/vnd.git-lfs+json');
      }
    }
    if (url.pathname.match(/\/objects\/[a-fA-F0-9]{64}$/)) {
      if (!headers.has('Accept')) {
        headers.set('Accept', 'application/octet-stream');
      }
    }
  }
}
