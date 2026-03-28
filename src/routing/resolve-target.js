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

import { SORTED_PLATFORMS } from './platform-index.js';
import { transformPath } from './platform-transformers.js';
import { normalizeRegistryApiPath } from '../protocols/docker.js';
import { isFlatpakReferenceFilePath } from '../utils/rewrite.js';
import { createErrorResponse } from '../utils/security.js';

export const HOME_PAGE_URL = 'https://github.com/xixu-me/Xget';

/**
 * Creates the canonical homepage redirect response.
 * @returns {Response} Redirect response to the Xget homepage.
 */
export function createHomepageRedirect() {
  return Response.redirect(HOME_PAGE_URL, 302);
}

/**
 * Normalizes request paths before platform routing.
 * @param {URL} url
 * @param {boolean} isDocker
 * @returns {{ effectivePath: string } | { response: Response }} Normalized path or an early error response.
 */
export function normalizeEffectivePath(url, isDocker) {
  let effectivePath = url.pathname;

  if (!isDocker) {
    return { effectivePath };
  }

  if (
    !url.pathname.startsWith('/cr/') &&
    !url.pathname.startsWith('/v2/cr/') &&
    url.pathname !== '/v2/auth'
  ) {
    return {
      response: createErrorResponse('container registry requests must use /cr/ prefix', 400)
    };
  }

  effectivePath = url.pathname.replace(/^\/v2/, '');

  if (url.pathname.startsWith('/v2/cr/')) {
    effectivePath = effectivePath.replace(/^\/cr\/([^/]+)\//, '/cr/$1/v2/');
  }

  return { effectivePath };
}

/**
 * Resolves an effective request path to an upstream target URL.
 * @param {URL} url
 * @param {string} effectivePath
 * @param {{ [key: string]: string }} platforms
 * @returns {{
 *   cacheTargetUrl: string,
 *   platform: string,
 *   shouldVaryCacheByOrigin: boolean,
 *   targetPath: string,
 *   targetUrl: string
 * } | { response: Response }} Target metadata or an early redirect response.
 */
export function resolveTarget(url, effectivePath, platforms) {
  const platform =
    SORTED_PLATFORMS.find(key => {
      const expectedPrefix = `/${key.replace('-', '/')}/`;
      return effectivePath.startsWith(expectedPrefix);
    }) || effectivePath.split('/')[1];

  if (!platform || !platforms[platform]) {
    return { response: createHomepageRedirect() };
  }

  const platformPath = `/${platform.replace(/-/g, '/')}`;
  if (effectivePath === platformPath || effectivePath === `${platformPath}/`) {
    return { response: createHomepageRedirect() };
  }

  const transformedPath = transformPath(effectivePath, platform);
  const targetPath = platform.startsWith('cr-')
    ? normalizeRegistryApiPath(platform, transformedPath)
    : transformedPath;
  const targetUrl = `${platforms[platform]}${targetPath}${url.search}`;
  const shouldVaryCacheByOrigin =
    platform === 'flathub' && isFlatpakReferenceFilePath(effectivePath);
  const cacheTargetUrl = shouldVaryCacheByOrigin
    ? `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}__xget_origin=${encodeURIComponent(url.origin)}`
    : targetUrl;

  return {
    cacheTargetUrl,
    platform,
    shouldVaryCacheByOrigin,
    targetPath,
    targetUrl
  };
}
