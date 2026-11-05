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

import { CONFIG, createConfig } from '../config/index.js';
import { getRequestTraits } from '../utils/validation.js';

/**
 * Builds the shared request context used by all runtime adapters.
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @returns {{
 *   config: import('../config/index.js').ApplicationConfig,
 *   env: Record<string, unknown>,
 *   isAI: boolean,
 *   isCorsPreflight: boolean,
 *   isDocker: boolean,
 *   isGit: boolean,
 *   isGitLFS: boolean,
 *   isHF: boolean,
 *   request: Request,
 *   url: URL
 * }} Request context with parsed config, URL, and protocol traits.
 */
export function createRequestContext(request, env) {
  const runtimeEnv = env && typeof env === 'object' ? env : {};
  const config = env === undefined ? CONFIG : createConfig(runtimeEnv);
  const url = new URL(request.url);
  const traits = getRequestTraits(request, url);

  return {
    ...traits,
    config,
    env: runtimeEnv,
    isCorsPreflight:
      request.method === 'OPTIONS' &&
      request.headers.has('Origin') &&
      request.headers.has('Access-Control-Request-Method'),
    request,
    url
  };
}
