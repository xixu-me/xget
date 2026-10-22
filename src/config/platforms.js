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
