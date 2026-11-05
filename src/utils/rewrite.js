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
 * Platform-specific upstream response rewriting helpers.
 */

const FLATHUB_REPO_BASE_URL_PATTERN = /https:\/\/(?:dl\.)?flathub\.org\/repo\//g;
const FLATPAK_REFERENCE_FILE_PATTERN = /\.(flatpakrepo|flatpakref)$/i;

/**
 * Checks whether a successful upstream response should be rewritten before returning it.
 * @param {string} platform
 * @param {string} requestPath
 * @param {string} contentType
 * @returns {boolean} True when the upstream response body should be rewritten.
 */
export function shouldRewriteTextResponse(platform, requestPath, contentType = '') {
  if (platform === 'pypi') {
    return contentType.includes('text/html');
  }

  if (platform === 'npm') {
    return contentType.includes('application/json');
  }

  if (platform === 'flathub') {
    return FLATPAK_REFERENCE_FILE_PATTERN.test(requestPath);
  }

  return false;
}

/**
 * Checks whether a request path points to a Flatpak descriptor file.
 * @param {string} requestPath
 * @returns {boolean} True when the request targets a `.flatpakrepo` or `.flatpakref` file.
 */
export function isFlatpakReferenceFilePath(requestPath) {
  return FLATPAK_REFERENCE_FILE_PATTERN.test(requestPath);
}

/**
 * Rewrites upstream text responses so follow-up requests continue flowing through Xget.
 * @param {string} platform
 * @param {string} requestPath
 * @param {string} originalText
 * @param {string} origin
 * @returns {string} Rewritten response text.
 */
export function rewriteTextResponse(platform, requestPath, originalText, origin) {
  if (platform === 'pypi') {
    return originalText.replace(/https:\/\/files\.pythonhosted\.org/g, `${origin}/pypi/files`);
  }

  if (platform === 'npm') {
    return originalText.replace(/https:\/\/registry\.npmjs\.org\/([^/]+)/g, `${origin}/npm/$1`);
  }

  if (platform === 'flathub' && isFlatpakReferenceFilePath(requestPath)) {
    return originalText.replace(FLATHUB_REPO_BASE_URL_PATTERN, `${origin}/flathub/repo/`);
  }

  return originalText;
}
