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
