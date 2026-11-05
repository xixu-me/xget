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
 *   request: Request,
 *   env: Record<string, unknown>,
 *   params: object,
 *   waitUntil: (promise: Promise<unknown>) => void,
 *   next: () => Promise<Response>,
 *   data: object
 * }} PagesFunctionContext
 */

/**
 * Pages Function handler for all routes.
 *
 * This catch-all route handler processes all incoming requests to the Xget
 * acceleration engine. It delegates request processing to the main handleRequest
 * function from the Workers code, maintaining full compatibility with the
 * existing implementation.
 *
 * The [[path]] syntax in the filename creates a catch-all route that matches
 * any path, allowing this single function to handle all requests to the Pages
 * application.
 * @param {PagesFunctionContext} context - Pages Function context
 * @returns {Promise<Response>} The HTTP response to return to the client
 * @example
 * // This is called automatically by Pages
 * // Runtime invokes: onRequest(context)
 * // Returns: Response with package data
 * @example
 * // Environment variables usage
 * // wrangler.toml: [vars] TIMEOUT_SECONDS = "60"
 * // context.env contains: { TIMEOUT_SECONDS: "60" }
 * // handleRequest uses createConfig(env) to override defaults
 */
export async function onRequest(context) {
  // Extract request, env, and create an execution context compatible with Workers
  const { request, env, waitUntil } = context;

  // Create a minimal ExecutionContext-like object for compatibility
  const ctx = {
    waitUntil,
    passThroughOnException: () => {
      // Pages doesn't support passThroughOnException, so this is a no-op
      console.warn('passThroughOnException is not supported in Pages Functions');
    }
  };

  // Delegate to the main request handler
  return handleRequest(request, env, ctx);
}
