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
