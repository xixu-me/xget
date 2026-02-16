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

import { PLATFORMS } from './platforms.js';

/**
 * Security-related configuration options for request validation and CORS.
 * @typedef {object} SecurityConfig
 * @property {string[]} ALLOWED_METHODS - List of allowed HTTP methods for incoming requests
 * @property {string[]} ALLOWED_ORIGINS - List of allowed CORS origins (use ['*'] for all origins)
 * @property {number} MAX_PATH_LENGTH - Maximum allowed URL path length in characters
 * @example
 * // Default security config
 * const security = {
 *   ALLOWED_METHODS: ['GET', 'HEAD'],
 *   ALLOWED_ORIGINS: ['*'],
 *   MAX_PATH_LENGTH: 2048
 * };
 * @example
 * // Custom security config with restricted origins
 * const security = {
 *   ALLOWED_METHODS: ['GET', 'HEAD', 'POST'],
 *   ALLOWED_ORIGINS: ['https://example.com', 'https://app.example.com'],
 *   MAX_PATH_LENGTH: 4096
 * };
 */

/**
 * Complete application configuration object with runtime settings.
 *
 * This configuration controls timeout behavior, retry logic, caching, security policies,
 * and platform URL mappings. All values can be overridden via environment variables
 * in Cloudflare Workers.
 * @typedef {object} ApplicationConfig
 * @property {number} TIMEOUT_SECONDS - Request timeout in seconds (default: 30)
 * @property {number} MAX_RETRIES - Maximum number of retry attempts for failed requests (default: 3)
 * @property {number} RETRY_DELAY_MS - Delay between retry attempts in milliseconds (default: 1000)
 * @property {number} CACHE_DURATION - Cache duration in seconds for successful responses (default: 1800)
 * @property {SecurityConfig} SECURITY - Security-related configurations
 * @property {{ [key: string]: string }} PLATFORMS - Platform-specific base URL mappings
 * @example
 * // Default configuration
 * const config = {
 *   TIMEOUT_SECONDS: 30,
 *   MAX_RETRIES: 3,
 *   RETRY_DELAY_MS: 1000,
 *   CACHE_DURATION: 1800,
 *   SECURITY: {
 *     ALLOWED_METHODS: ['GET', 'HEAD'],
 *     ALLOWED_ORIGINS: ['*'],
 *     MAX_PATH_LENGTH: 2048
 *   },
 *   PLATFORMS: { gh: 'https://github.com', ... }
 * };
 * @example
 * // Configuration with environment overrides
 * const env = {
 *   TIMEOUT_SECONDS: '60',
 *   MAX_RETRIES: '5',
 *   CACHE_DURATION: '3600'
 * };
 * const config = createConfig(env);
 * // Results in timeout of 60s, 5 retries, 1 hour cache
 */

/**
 * Creates application configuration with environment variable overrides.
 *
 * This function merges default configuration values with environment-specific overrides
 * provided by Cloudflare Workers. Environment variables are parsed as integers where
 * applicable, and fallback to defaults if parsing fails or values are missing.
 *
 * **Environment variable mapping:**
 * - `TIMEOUT_SECONDS` - Override default timeout (default: 30)
 * - `MAX_RETRIES` - Override max retry attempts (default: 3)
 * - `RETRY_DELAY_MS` - Override retry delay (default: 1000)
 * - `CACHE_DURATION` - Override cache TTL (default: 1800 = 30 minutes)
 * - `ALLOWED_METHODS` - Comma-separated HTTP methods (default: 'GET,HEAD')
 * - `ALLOWED_ORIGINS` - Comma-separated CORS origins (default: '*')
 * - `MAX_PATH_LENGTH` - Override max path length (default: 2048)
 * @param {Record<string, unknown>} env - Environment variables from Cloudflare Workers env object
 * @returns {ApplicationConfig} Complete application configuration with applied overrides
 * @example
 * // Create config with defaults (no environment variables)
 * const config = createConfig();
 * console.log(config.TIMEOUT_SECONDS); // 30
 * console.log(config.CACHE_DURATION); // 1800
 * @example
 * // Create config with environment overrides
 * const env = {
 *   TIMEOUT_SECONDS: '60',
 *   MAX_RETRIES: '5',
 *   CACHE_DURATION: '3600',
 *   ALLOWED_METHODS: 'GET,HEAD,POST,PUT'
 * };
 * const config = createConfig(env);
 * console.log(config.TIMEOUT_SECONDS); // 60
 * console.log(config.MAX_RETRIES); // 5
 * console.log(config.CACHE_DURATION); // 3600 (1 hour)
 * console.log(config.SECURITY.ALLOWED_METHODS); // ['GET', 'HEAD', 'POST', 'PUT']
 * @example
 * // Invalid environment values fallback to defaults
 * const env = {
 *   TIMEOUT_SECONDS: 'invalid',
 *   MAX_RETRIES: 'not-a-number'
 * };
 * const config = createConfig(env);
 * console.log(config.TIMEOUT_SECONDS); // 30 (default)
 * console.log(config.MAX_RETRIES); // 3 (default)
 * @example
 * // Custom CORS origins
 * const env = {
 *   ALLOWED_ORIGINS: 'https://example.com,https://app.example.com'
 * };
 * const config = createConfig(env);
 * console.log(config.SECURITY.ALLOWED_ORIGINS);
 * // ['https://example.com', 'https://app.example.com']
 */
export function createConfig(env = {}) {
  return {
    TIMEOUT_SECONDS: parseInt(String(env.TIMEOUT_SECONDS), 10) || 30,
    MAX_RETRIES: parseInt(String(env.MAX_RETRIES), 10) || 3,
    RETRY_DELAY_MS: parseInt(String(env.RETRY_DELAY_MS), 10) || 1000,
    CACHE_DURATION: parseInt(String(env.CACHE_DURATION), 10) || 1800, // 30 minutes
    SECURITY: {
      ALLOWED_METHODS:
        typeof env.ALLOWED_METHODS === 'string' ? env.ALLOWED_METHODS.split(',') : ['GET', 'HEAD'],
      ALLOWED_ORIGINS:
        typeof env.ALLOWED_ORIGINS === 'string' ? env.ALLOWED_ORIGINS.split(',') : ['*'],
      MAX_PATH_LENGTH: parseInt(String(env.MAX_PATH_LENGTH), 10) || 2048
    },
    PLATFORMS
  };
}

/**
 * Default application configuration instance.
 *
 * This is a pre-instantiated configuration object using default values with no
 * environment overrides. In production (Cloudflare Workers), you should use
 * `createConfig(env)` instead to allow runtime configuration.
 * @type {ApplicationConfig}
 * @example
 * // Import default config
 * import { CONFIG } from './config/index.js';
 * console.log(CONFIG.TIMEOUT_SECONDS); // 30
 * @example
 * // Check platform availability
 * if (CONFIG.PLATFORMS.npm) {
 *   console.log('npm platform available');
 * }
 */
export const CONFIG = createConfig();
