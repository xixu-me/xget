/**
 * Xget - High-performance acceleration engine for developer resources
 * Copyright (C) 2025 Xi Xu
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Netlify Edge Function entry point.
 *
 * This file serves as a redirect to the edge function handler
 * located at /api/index.js. Both Netlify and Vercel can use the same
 * handler code, with platform detection handling the differences.
 *
 * Netlify requires edge functions to be in netlify/edge-functions/,
 * while Vercel uses /api/ directory. This approach maintains a single
 * source of truth at /api/index.js.
 */
export { config, default } from '../../api/index.js';

