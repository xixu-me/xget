/**
 * Xget - High-performance acceleration engine for developer resources
 * Copyright (C) Xi Xu
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { handleRequest } from './app/handle-request.js';

export { handleRequest } from './app/handle-request.js';

export default {
  /**
   * Main Worker entry point.
   * @param {Request} request
   * @param {Record<string, unknown>} env
   * @param {ExecutionContext} ctx
   */
  fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  }
};
