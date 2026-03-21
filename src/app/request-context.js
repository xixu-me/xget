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
