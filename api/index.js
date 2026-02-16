/**
 * Xget - High-performance acceleration engine for developer resources
 * Copyright (C) 2025 Xi Xu
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */



import { handleRequest } from '../src/index.js';

/**
 * Edge Function handler.
 * @param {Request} request - Standard Web API Request object
 * @param {object} [context] - Platform-specific context (Netlify only)
 * @param {object} [context.geo] - Geolocation data (Netlify)
 * @param {string} [context.ip] - Client IP address (Netlify)
 * @param {object} [context.env] - Environment variables (Netlify)
 * @param {(promise: Promise<unknown>) => void} [context.waitUntil] - Background task extension (Netlify)
 * @returns {Promise<Response>} Standard Web API Response
 * @example
 * // Netlify invokes with context
 * handler(request, { geo: {...}, ip: '1.2.3.4', env: {...}, waitUntil: fn })
 * @example
 * // Vercel invokes without context
 * handler(request)
 */
export default async function handler(request, context) {
  // Detect runtime environment
  const isNetlify = context && (context.geo !== undefined || context.ip !== undefined);

  // Normalize environment variables
  // Netlify provides context.env, Vercel Edge uses globalThis
  let envSource;
  if (isNetlify) {
    envSource = context.env || {};
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
    MAX_PATH_LENGTH: envSource.MAX_PATH_LENGTH,
  };

  // Create normalized execution context
  const ctx = {
    waitUntil: isNetlify && context.waitUntil
      ? (promise) => context.waitUntil(promise)
      : (_promise) => {
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
  runtime: 'edge',
};
