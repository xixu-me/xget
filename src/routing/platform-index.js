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
