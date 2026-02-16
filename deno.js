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

/* eslint-disable no-undef, no-unused-vars */

import { handleRequest } from './src/index.js';

/**
 * Deno Deploy handler.
 *
 * This is the entry point for Deno Deploy deployments. It uses the
 * standard Deno.serve() API to handle incoming HTTP requests.
 * @param {Request} request - Standard Web API Request object
 * @returns {Promise<Response>} Standard Web API Response
 * @example
 * // Deno Deploy invokes automatically:
 * // Deno.serve((request) => handler(request))
 */
async function handler(request) {
  // Extract environment variables from Deno.env
  const env = {
    TIMEOUT_SECONDS: Deno.env.get('TIMEOUT_SECONDS'),
    MAX_RETRIES: Deno.env.get('MAX_RETRIES'),
    RETRY_DELAY_MS: Deno.env.get('RETRY_DELAY_MS'),
    CACHE_DURATION: Deno.env.get('CACHE_DURATION'),
    ALLOWED_METHODS: Deno.env.get('ALLOWED_METHODS'),
    ALLOWED_ORIGINS: Deno.env.get('ALLOWED_ORIGINS'),
    MAX_PATH_LENGTH: Deno.env.get('MAX_PATH_LENGTH'),
  };

  // Create minimal ExecutionContext-like object
  // Deno Deploy doesn't support waitUntil, so cache writes are synchronous
  const ctx = {
    waitUntil: (promise) => {
      // No-op on Deno: background tasks not supported
      console.warn('waitUntil is not supported in Deno Deploy');
    },
    passThroughOnException: () => {
      console.warn('passThroughOnException is not supported in Deno Deploy');
    }
  };

  // Delegate to the main request handler
  return handleRequest(request, env, ctx);
}

// Start the server
Deno.serve(handler);
