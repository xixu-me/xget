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
 * AI Inference protocol handler for Xget
 */

/**
 * Detects if a request is for an AI inference provider API.
 *
 * Identifies AI inference requests by checking for:
 * - AI provider path prefix (/ip/{provider}/...)
 * - Common AI API endpoints (chat, completions, embeddings, etc.)
 * - AI-specific URL patterns with JSON POST requests
 * @param {Request} request - The incoming request object
 * @param {URL} url - Parsed URL object
 * @returns {boolean} True if this is an AI inference request
 */
export function isAIInferenceRequest(request, url) {
  // Check for AI inference provider paths (ip/{provider}/...)
  if (url.pathname.startsWith('/ip/')) {
    return true;
  }

  // Check for common AI inference API endpoints
  const aiEndpoints = [
    '/v1/chat/completions',
    '/v1/completions',
    '/v1/messages',
    '/v1/predictions',
    '/v1/generate',
    '/v1/embeddings',
    '/openai/v1/chat/completions'
  ];

  if (aiEndpoints.some(endpoint => url.pathname.includes(endpoint))) {
    return true;
  }

  // Check for AI-specific content types
  const contentType = request.headers.get('Content-Type') || '';
  if (contentType.includes('application/json') && request.method === 'POST') {
    // Additional check for common AI inference patterns in URL
    if (
      url.pathname.includes('/chat/') ||
      url.pathname.includes('/completions') ||
      url.pathname.includes('/generate') ||
      url.pathname.includes('/predict')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Configures headers for AI protocol requests.
 *
 * Sets Content-Type and User-Agent headers for AI inference requests.
 * @param {Headers} headers - The headers object to modify
 * @param {Request} request - The original request
 */
export function configureAIHeaders(headers, request) {
  if (request.method === 'POST' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('User-Agent')) {
    headers.set('User-Agent', 'Xget-AI-Proxy/1.0');
  }
}
