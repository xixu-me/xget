import { PLATFORM_CATALOG } from '../config/platform-catalog.js';

/**
 * Converts a platform key into its matching URL prefix.
 * @param {string} platformKey
 * @returns {string} Platform prefix, for example `/ip/openai/`.
 */
export function getPlatformPathPrefix(platformKey) {
  return `/${platformKey.replace(/-/g, '/')}/`;
}

/**
 * Pre-computed sorted platform keys for efficient path matching.
 */
export const SORTED_PLATFORMS = Object.keys(PLATFORM_CATALOG).sort((a, b) => {
  return getPlatformPathPrefix(b).length - getPlatformPathPrefix(a).length;
});
