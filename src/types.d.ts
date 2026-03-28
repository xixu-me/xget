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
 * Global type declarations for Cloudflare Workers
 */

/**
 * Cloudflare Workers execution context
 * Provides methods for managing background tasks
 */
interface ExecutionContext {
  /**
   * Extend the lifetime of the request handler
   * @param promise - Promise to wait for in the background
   */
  waitUntil(promise: Promise<any>): void;

  /**
   * Prevent request from failing if an exception is thrown
   */
  passThroughOnException(): void;
}

interface DenoEnv {
  /**
   * Reads an environment variable from Deno Deploy.
   * @param name - Environment variable name
   */
  get(name: string): string | undefined;
}

interface DenoGlobal {
  env: DenoEnv;

  /**
   * Starts the Deno Deploy HTTP server.
   * @param handler - Request handler callback
   */
  serve(handler: (request: Request) => Promise<Response> | Response): void;
}

declare const Deno: DenoGlobal;
