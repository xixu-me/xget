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

/**
 * Security utility functions for Xget
 */

/**
 * Adds comprehensive security headers to response headers.
 *
 * applies industry-standard security headers including:
 * - HSTS (HTTP Strict Transport Security)
 * - X-Frame-Options (clickjacking protection)
 * - X-XSS-Protection (XSS filter)
 * - Referrer-Policy (referrer information control)
 * - Content-Security-Policy (resource loading restrictions)
 * - Permissions-Policy (privacy-invasive feature restrictions)
 * @param {Headers} headers - Headers object to modify (mutates in place)
 * @returns {Headers} Modified headers object (same reference)
 */
export function addSecurityHeaders(headers) {
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; script-src 'none'");
  headers.set('Permissions-Policy', 'interest-cohort=()');
  return headers;
}

/**
 * Creates a standardized error response with security headers.
 *
 * Generates an HTTP error response with appropriate content type and security headers.
 * Can return either plain text or detailed JSON error format.
 * @param {string} message - Error message to display
 * @param {number} status - HTTP status code (e.g., 400, 404, 500)
 * @param {boolean} includeDetails - Whether to include detailed JSON error information
 * @returns {Response} Error response with security headers
 */
export function createErrorResponse(message, status, includeDetails = false) {
  const errorBody = includeDetails
    ? JSON.stringify({ error: message, status, timestamp: new Date().toISOString() })
    : message;

  return new Response(errorBody, {
    status,
    headers: addSecurityHeaders(
      new Headers({
        'Content-Type': includeDetails ? 'application/json' : 'text/plain'
      })
    )
  });
}
