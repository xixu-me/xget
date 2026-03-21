/**
 * Compatibility exports for platform configuration and routing helpers.
 *
 * New code should prefer:
 * - `src/config/platform-catalog.js` for base URL data
 * - `src/routing/platform-index.js` for matching order
 * - `src/routing/platform-transformers.js` for path normalization
 */
export { PLATFORM_CATALOG, PLATFORMS } from './platform-catalog.js';
export { SORTED_PLATFORMS } from '../routing/platform-index.js';
export { transformPath } from '../routing/platform-transformers.js';
