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
