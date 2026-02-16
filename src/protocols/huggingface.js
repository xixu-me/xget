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
 * Hugging Face protocol handler for Xget
 */

/**
 * Detects if a request is a Hugging Face API operation.
 *
 * Identifies Hugging Face API requests by checking for:
 * - Hugging Face platform prefix (/hf/)
 * - API path segment (/api/)
 * @param {Request} request - The incoming request object
 * @param {URL} url - Parsed URL object
 * @returns {boolean} True if this is a Hugging Face API operation
 */
export function isHuggingFaceAPIRequest(request, url) {
  // Check for Hugging Face API endpoints
  if (url.pathname.startsWith('/hf/api/')) {
    return true;
  }

  // Also check for token endpoint which is often used
  if (url.pathname.startsWith('/hf/token')) {
    return true;
  }

  return false;
}

/**
 * Configures headers for Hugging Face API requests.
 * @param {Headers} headers - The headers object to modify
 * @param {Request} request - The original request
 */
export function configureHuggingFaceHeaders(headers, request) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    headers.set('Authorization', authHeader);
  }

  if (request.method === 'POST' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
}
