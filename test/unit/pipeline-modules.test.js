import { afterEach, describe, expect, it, vi } from 'vitest';

import { createRequestContext } from '../../src/app/request-context.js';
import { CONFIG } from '../../src/config/index.js';
import { finalizeResponse } from '../../src/response/finalize-response.js';
import { resolveTarget } from '../../src/routing/resolve-target.js';
import { tryReadCachedResponse } from '../../src/upstream/cache.js';
import { fetchUpstreamResponse } from '../../src/upstream/fetch-upstream.js';
import { PerformanceMonitor } from '../../src/utils/performance.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Pipeline modules', () => {
  it('reuses cached full content for range requests through the cache helper', async () => {
    const cache = {
      match: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(
          new Response('full-body', {
            status: 200,
            headers: { 'Content-Type': 'text/plain' }
          })
        )
    };
    const monitor = new PerformanceMonitor();
    const markSpy = vi.spyOn(monitor, 'mark');
    const request = new Request('https://example.com/gh/user/repo/file.txt', {
      headers: { Range: 'bytes=0-3' }
    });

    const response = await tryReadCachedResponse({
      cache: /** @type {Cache} */ (/** @type {unknown} */ (cache)),
      cacheTargetUrl: 'https://github.com/user/repo/file.txt',
      canUseCache: true,
      hasSensitiveHeaders: false,
      monitor,
      request,
      requestContext: createRequestContext(request, {})
    });

    expect(await response?.text()).toBe('full-body');
    expect(markSpy).toHaveBeenCalledWith('cache_hit_full_content');
  });

  it('retries upstream fetches through the transport helper before succeeding', async () => {
    const request = new Request('https://example.com/gh/user/repo/file.txt');
    const requestContext = createRequestContext(request, {});
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('temporary-network-error'))
      .mockResolvedValueOnce(
        new Response('ok', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        })
      );

    const result = await fetchUpstreamResponse({
      authorization: null,
      canUseCache: true,
      config: { ...CONFIG, MAX_RETRIES: 2, RETRY_DELAY_MS: 0 },
      effectivePath: '/gh/user/repo/file.txt',
      monitor: new PerformanceMonitor(),
      platform: 'gh',
      request,
      requestContext,
      shouldPassthroughRequest: false,
      targetUrl: 'https://github.com/user/repo/file.txt'
    });

    expect(result.responseGeneratedLocally).toBe(false);
    expect(result.response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('forwards client Accept header on non-passthrough upstream fetches', async () => {
    const accept = 'application/vnd.oci.image.index.v1+json';
    const request = new Request(
      'https://example.com/homebrew/bottles/v2/homebrew/core/wget/manifests/1.21.4',
      {
        headers: { Accept: accept }
      }
    );
    const requestContext = createRequestContext(request, {});
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const result = await fetchUpstreamResponse({
      authorization: null,
      canUseCache: true,
      config: { ...CONFIG, MAX_RETRIES: 1, RETRY_DELAY_MS: 0 },
      effectivePath: '/homebrew/bottles/v2/homebrew/core/wget/manifests/1.21.4',
      monitor: new PerformanceMonitor(),
      platform: 'homebrew-bottles',
      request,
      requestContext,
      shouldPassthroughRequest: false,
      targetUrl: 'https://ghcr.io/v2/homebrew/core/wget/manifests/1.21.4'
    });

    expect(result.response.status).toBe(200);
    const upstreamHeaders = new Headers(fetchSpy.mock.calls[0][1]?.headers);
    expect(upstreamHeaders.get('Accept')).toBe(accept);
    expect(upstreamHeaders.get('User-Agent')).toBe('Wget/1.21.3');
  });

  it('rewrites npm metadata and refreshes content length during response finalization', async () => {
    const request = new Request('https://example.com/npm/pkg');
    const requestContext = createRequestContext(request, {});
    const upstreamBody = JSON.stringify({
      dist: {
        tarball: 'https://registry.npmjs.org/pkg/-/pkg-1.0.0.tgz'
      }
    });

    const response = await finalizeResponse({
      cache: null,
      cacheTargetUrl: 'https://registry.npmjs.org/pkg',
      canUseCache: true,
      config: CONFIG,
      ctx: /** @type {ExecutionContext} */ ({ waitUntil() {}, passThroughOnException() {} }),
      effectivePath: '/npm/pkg',
      hasSensitiveHeaders: false,
      monitor: new PerformanceMonitor(),
      platform: 'npm',
      request,
      requestContext,
      response: new Response(upstreamBody, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(upstreamBody.length)
        }
      }),
      responseGeneratedLocally: false,
      url: new URL(request.url)
    });
    const body = await response.text();

    expect(body).toContain('https://example.com/npm/pkg/-/pkg-1.0.0.tgz');
    expect(response.headers.get('Content-Length')).toBe(
      String(new TextEncoder().encode(body).byteLength)
    );
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=0, s-maxage=60, must-revalidate'
    );
  });

  it('uses long-lived caching for immutable package artifacts', async () => {
    const artifactCases = [
      {
        cacheTargetUrl: 'https://registry.npmjs.org/pkg/-/pkg-1.0.0.tgz',
        effectivePath: '/npm/pkg/-/pkg-1.0.0.tgz',
        platform: 'npm',
        requestUrl: 'https://example.com/npm/pkg/-/pkg-1.0.0.tgz'
      },
      {
        cacheTargetUrl:
          'https://files.pythonhosted.org/packages/py3/r/requests/requests-2.31.0-py3-none-any.whl',
        effectivePath: '/pypi/files/packages/py3/r/requests/requests-2.31.0-py3-none-any.whl',
        platform: 'pypi-files',
        requestUrl:
          'https://example.com/pypi/files/packages/py3/r/requests/requests-2.31.0-py3-none-any.whl'
      },
      {
        cacheTargetUrl:
          'https://files.pythonhosted.org/packages/source/r/requests/requests-2.31.0.tar.gz',
        effectivePath: '/pypi/files/packages/source/r/requests/requests-2.31.0.tar.gz',
        platform: 'pypi-files',
        requestUrl:
          'https://example.com/pypi/files/packages/source/r/requests/requests-2.31.0.tar.gz'
      },
      {
        cacheTargetUrl: 'https://repo1.maven.org/maven2/org/example/demo/1.0.0/demo-1.0.0.jar',
        effectivePath: '/maven/maven2/org/example/demo/1.0.0/demo-1.0.0.jar',
        platform: 'maven',
        requestUrl: 'https://example.com/maven/maven2/org/example/demo/1.0.0/demo-1.0.0.jar'
      },
      {
        cacheTargetUrl: 'https://github.com/user/repo/releases/download/v1.2.3/file.tar.gz',
        effectivePath: '/gh/user/repo/releases/download/v1.2.3/file.tar.gz',
        platform: 'gh',
        requestUrl: 'https://example.com/gh/user/repo/releases/download/v1.2.3/file.tar.gz'
      }
    ];

    for (const artifactCase of artifactCases) {
      const request = new Request(artifactCase.requestUrl);
      const requestContext = createRequestContext(request, {});

      const response = await finalizeResponse({
        cache: null,
        cacheTargetUrl: artifactCase.cacheTargetUrl,
        canUseCache: true,
        config: CONFIG,
        ctx: /** @type {ExecutionContext} */ ({ waitUntil() {}, passThroughOnException() {} }),
        effectivePath: artifactCase.effectivePath,
        hasSensitiveHeaders: false,
        monitor: new PerformanceMonitor(),
        platform: artifactCase.platform,
        request,
        requestContext,
        response: new Response('artifact-data', {
          status: 200,
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': '13'
          }
        }),
        responseGeneratedLocally: false,
        url: new URL(request.url)
      });

      expect(response.headers.get('Cache-Control')).toBe(
        'public, max-age=3600, s-maxage=86400, immutable'
      );
    }
  });

  it('does not treat mutable branch archives as immutable artifacts', async () => {
    const archiveCases = [
      {
        cacheTargetUrl: 'https://github.com/user/repo/archive/refs/heads/main.zip',
        effectivePath: '/gh/user/repo/archive/refs/heads/main.zip',
        platform: 'gh',
        requestUrl: 'https://example.com/gh/user/repo/archive/refs/heads/main.zip'
      },
      {
        cacheTargetUrl:
          'https://github.com/Homebrew/homebrew-cask/archive/refs/heads/master.tar.gz',
        effectivePath: '/homebrew/homebrew-cask.git/archive/refs/heads/master.tar.gz',
        platform: 'homebrew',
        requestUrl:
          'https://example.com/homebrew/homebrew-cask.git/archive/refs/heads/master.tar.gz'
      },
      {
        cacheTargetUrl: 'https://github.com/user/repo/releases/download/latest/file.zip',
        effectivePath: '/gh/user/repo/releases/download/latest/file.zip',
        platform: 'gh',
        requestUrl: 'https://example.com/gh/user/repo/releases/download/latest/file.zip'
      },
      {
        cacheTargetUrl: 'https://files.pythonhosted.org/packages/source/p/pkg/latest.tar.gz',
        effectivePath: '/pypi/files/packages/source/p/pkg/latest.tar.gz',
        platform: 'pypi-files',
        requestUrl: 'https://example.com/pypi/files/packages/source/p/pkg/latest.tar.gz'
      },
      {
        cacheTargetUrl:
          'https://files.pythonhosted.org/packages/py3/p/pkg/pkg-latest-py3-none-any.whl',
        effectivePath: '/pypi/files/packages/py3/p/pkg/pkg-latest-py3-none-any.whl',
        platform: 'pypi-files',
        requestUrl: 'https://example.com/pypi/files/packages/py3/p/pkg/pkg-latest-py3-none-any.whl'
      }
    ];

    for (const archiveCase of archiveCases) {
      const request = new Request(archiveCase.requestUrl);
      const requestContext = createRequestContext(request, {});

      const response = await finalizeResponse({
        cache: null,
        cacheTargetUrl: archiveCase.cacheTargetUrl,
        canUseCache: true,
        config: CONFIG,
        ctx: /** @type {ExecutionContext} */ ({ waitUntil() {}, passThroughOnException() {} }),
        effectivePath: archiveCase.effectivePath,
        hasSensitiveHeaders: false,
        monitor: new PerformanceMonitor(),
        platform: archiveCase.platform,
        request,
        requestContext,
        response: new Response('archive-data', {
          status: 200,
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': '12'
          }
        }),
        responseGeneratedLocally: false,
        url: new URL(request.url)
      });

      expect(response.headers.get('Cache-Control')).toBe(
        'public, max-age=0, s-maxage=300, must-revalidate'
      );
    }
  });

  it('varies npm metadata cache keys by request origin after rewriting', () => {
    const targetA = resolveTarget(
      new URL('https://mirror-a.example/npm/pkg'),
      '/npm/pkg',
      CONFIG.PLATFORMS
    );
    const targetB = resolveTarget(
      new URL('https://mirror-b.example/npm/pkg'),
      '/npm/pkg',
      CONFIG.PLATFORMS
    );

    expect('cacheTargetUrl' in targetA && targetA.cacheTargetUrl).toContain(
      '__xget_origin=https%3A%2F%2Fmirror-a.example'
    );
    expect('cacheTargetUrl' in targetB && targetB.cacheTargetUrl).toContain(
      '__xget_origin=https%3A%2F%2Fmirror-b.example'
    );
    expect('cacheTargetUrl' in targetA && 'cacheTargetUrl' in targetB).toBe(true);
    if ('cacheTargetUrl' in targetA && 'cacheTargetUrl' in targetB) {
      expect(targetA.cacheTargetUrl).not.toBe(targetB.cacheTargetUrl);
    }
  });

  it('handles Docker 401 responses without auth challenges during finalization', async () => {
    const request = new Request('https://example.com/cr/ghcr/v2/user/repo/manifests/latest');
    const requestContext = {
      ...createRequestContext(request, {}),
      isDocker: true
    };

    const customUnauthorized = await finalizeResponse({
      cache: null,
      cacheTargetUrl: 'https://ghcr.io/v2/user/repo/manifests/latest',
      canUseCache: false,
      config: CONFIG,
      ctx: /** @type {ExecutionContext} */ ({ waitUntil() {}, passThroughOnException() {} }),
      effectivePath: '/cr/ghcr/v2/user/repo/manifests/latest',
      hasSensitiveHeaders: false,
      monitor: new PerformanceMonitor(),
      platform: 'cr-ghcr',
      request,
      requestContext,
      response: new Response('{"errors":[{"code":"UNAUTHORIZED"}]}', {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }),
      responseGeneratedLocally: false,
      url: new URL(request.url)
    });

    const plainUnauthorized = await finalizeResponse({
      cache: null,
      cacheTargetUrl: 'https://ghcr.io/v2/user/repo/manifests/latest',
      canUseCache: false,
      config: CONFIG,
      ctx: /** @type {ExecutionContext} */ ({ waitUntil() {}, passThroughOnException() {} }),
      effectivePath: '/cr/ghcr/v2/user/repo/manifests/latest',
      hasSensitiveHeaders: false,
      monitor: new PerformanceMonitor(),
      platform: 'cr-ghcr',
      request,
      requestContext,
      response: new Response('denied', {
        status: 401,
        headers: { 'Content-Type': 'text/plain' }
      }),
      responseGeneratedLocally: false,
      url: new URL(request.url)
    });

    expect(customUnauthorized.status).toBe(401);
    expect(await customUnauthorized.text()).toContain('UNAUTHORIZED');
    expect(plainUnauthorized.status).toBe(401);
    expect(await plainUnauthorized.text()).toContain('Original error: denied');
  });

  it('preserves upstream protocol error responses during finalization', async () => {
    const request = new Request('https://example.com/ip/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    const requestContext = createRequestContext(request, {});
    const upstreamBody = JSON.stringify({
      error: {
        message: 'bad key',
        type: 'invalid_request_error'
      }
    });

    const response = await finalizeResponse({
      cache: null,
      cacheTargetUrl: 'https://api.openai.com/v1/chat/completions',
      canUseCache: false,
      config: CONFIG,
      ctx: /** @type {ExecutionContext} */ ({ waitUntil() {}, passThroughOnException() {} }),
      effectivePath: '/ip/openai/v1/chat/completions',
      hasSensitiveHeaders: true,
      monitor: new PerformanceMonitor(),
      platform: 'ip-openai',
      request,
      requestContext,
      response: new Response(upstreamBody, {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'X-Upstream-Trace': 'trace-123'
        }
      }),
      responseGeneratedLocally: false,
      url: new URL(request.url)
    });

    expect(response.status).toBe(401);
    expect(response.headers.get('X-Upstream-Trace')).toBe('trace-123');
    expect(await response.text()).toBe(upstreamBody);
  });
});
