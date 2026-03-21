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

import { handleRequest } from '../src/app/handle-request.js';

/**
 * @typedef {{
 *   ALLOWED_METHODS?: string,
 *   ALLOWED_ORIGINS?: string,
 *   CACHE_DURATION?: string,
 *   MAX_PATH_LENGTH?: string,
 *   MAX_RETRIES?: string,
 *   RETRY_DELAY_MS?: string,
 *   TIMEOUT_SECONDS?: string
 * }} RuntimeEnv
 */

/**
 * @typedef {{
 *   env?: RuntimeEnv,
 *   geo?: unknown,
 *   ip?: string,
 *   waitUntil?: (promise: Promise<unknown>) => void
 * }} FunctionAdapterContext
 */

/**
 * Edge Function handler.
 * @param {Request} request - Standard Web API Request object
 * @param {FunctionAdapterContext} [context] - Platform-specific context (Netlify only)
 * @returns {Promise<Response>} Standard Web API Response
 * @example
 * // Netlify invokes with context
 * handler(request, { geo: {...}, ip: '1.2.3.4', env: {...}, waitUntil: fn })
 * @example
 * // Vercel invokes without context
 * handler(request)
 */
export default async function handler(request, context) {
  const runtimeContext = context || /** @type {FunctionAdapterContext} */ ({});

  // Detect runtime environment
  const isNetlify = runtimeContext.geo !== undefined || runtimeContext.ip !== undefined;

  // Normalize environment variables
  // Netlify provides context.env, Vercel Edge uses globalThis
  /** @type {RuntimeEnv} */
  let envSource;
  if (isNetlify) {
    envSource = runtimeContext.env || {};
  } else if (typeof process !== 'undefined' && process.env) {
    // Vercel or Node.js environment
    envSource = process.env;
  } else {
    // Fallback for other environments
    envSource = {};
  }

  const env = {
    TIMEOUT_SECONDS: envSource.TIMEOUT_SECONDS,
    MAX_RETRIES: envSource.MAX_RETRIES,
    RETRY_DELAY_MS: envSource.RETRY_DELAY_MS,
    CACHE_DURATION: envSource.CACHE_DURATION,
    ALLOWED_METHODS: envSource.ALLOWED_METHODS,
    ALLOWED_ORIGINS: envSource.ALLOWED_ORIGINS,
    MAX_PATH_LENGTH: envSource.MAX_PATH_LENGTH
  };

  // Create normalized execution context
  const waitUntil = isNetlify && runtimeContext.waitUntil ? runtimeContext.waitUntil : null;
  const ctx = {
    waitUntil: waitUntil
      ? /**
         * Forwards background work in runtimes that support waitUntil.
         * @param {Promise<unknown>} promise
         */
        promise => waitUntil(promise)
      : (
          /** @type {Promise<unknown>} */
          _promise
        ) => {
          void _promise;
          // No-op on Vercel: background tasks not supported
          // Cache writes will run synchronously instead
          console.warn('waitUntil is not supported in Vercel Edge Runtime');
        },
    passThroughOnException: () => {
      // Not supported on either platform in this context
      console.warn('passThroughOnException is not universally supported');
    }
  };

  // Delegate to the main request handler
  return handleRequest(request, env, ctx);
}

// Vercel Edge Runtime configuration (ignored by Netlify)
export const config = {
  runtime: 'edge'
};
