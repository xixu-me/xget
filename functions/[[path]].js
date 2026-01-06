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
 * @param {object} context - Pages Function context
 * @param {Request} context.request - The incoming HTTP request
 * @param {object} context.env - Environment variables and bindings (KV, secrets, etc.)
 * @param {object} context.params - Route parameters (path segments from [[path]])
 * @param {(promise: Promise<unknown>) => void} context.waitUntil - Extend function execution for background tasks
 * @param {() => Promise<Response>} context.next - Call next middleware in chain (not used here)
 * @param {object} context.data - Shared data between functions
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
