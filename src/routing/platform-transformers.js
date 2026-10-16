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

import { PLATFORM_CATALOG } from '../config/platform-catalog.js';
import { getPlatformPathPrefix } from './platform-index.js';

/**
 * Escapes a string for safe use inside a regular expression.
 * @param {string} value
 * @returns {string} Escaped string.
 */
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Removes the platform prefix from a request path.
 * @param {string} path
 * @param {string} platformKey
 * @returns {string} Path without the leading platform segment.
 */
function stripPlatformPrefix(path, platformKey) {
  const prefix = getPlatformPathPrefix(platformKey);
  return path.replace(new RegExp(`^${escapeRegex(prefix)}`), '/');
}

/**
 * Applies crates.io-specific API path normalization.
 * @param {string} transformedPath
 * @returns {string} Normalized crates.io API path.
 */
function transformCratesPath(transformedPath) {
  if (!transformedPath.startsWith('/')) {
    return transformedPath;
  }

  if (transformedPath === '/' || transformedPath.startsWith('/?')) {
    return transformedPath.replace('/', '/api/v1/crates');
  }

  return `/api/v1/crates${transformedPath}`;
}

/**
 * Applies Fedora mirror path normalization.
 * @param {string} transformedPath
 * @returns {string} Normalized Fedora mirror path.
 */
function transformFedoraPath(transformedPath) {
  return transformedPath.replace(/^\/pub\/fedora\/linux(?=\/|$)/, '') || '/';
}

/**
 * Applies Jenkins update-center path normalization.
 * @param {string} transformedPath
 * @returns {string} Normalized Jenkins path.
 */
function transformJenkinsPath(transformedPath) {
  if (!transformedPath.startsWith('/')) {
    return transformedPath;
  }

  if (transformedPath === '/update-center.json') {
    return '/current/update-center.json';
  }

  if (transformedPath === '/update-center.actual.json') {
    return '/current/update-center.actual.json';
  }

  if (
    transformedPath.startsWith('/experimental/') ||
    transformedPath.startsWith('/download/') ||
    transformedPath.startsWith('/current/')
  ) {
    return transformedPath;
  }

  return `/current${transformedPath}`;
}

/** @type {{ [key: string]: (transformedPath: string) => string }} */
const PLATFORM_PATH_TRANSFORMERS = {
  crates: transformCratesPath,
  fedora: transformFedoraPath,
  jenkins: transformJenkinsPath
};

/**
 * Converts a routed request path into the upstream path expected by the platform.
 * @param {string} path
 * @param {string} platformKey
 * @returns {string} Upstream-ready request path.
 */
export function transformPath(path, platformKey) {
  if (!PLATFORM_CATALOG[platformKey]) {
    return path;
  }

  const transformedPath = stripPlatformPrefix(path, platformKey);
  const transformPlatformPath = PLATFORM_PATH_TRANSFORMERS[platformKey];

  return transformPlatformPath ? transformPlatformPath(transformedPath) : transformedPath;
}
