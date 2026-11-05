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

import { isFlatpakReferenceFilePath } from '../utils/rewrite.js';

const METADATA_EDGE_TTL_SECONDS = 60;
const MUTABLE_EDGE_TTL_SECONDS = 300;
const IMMUTABLE_EDGE_TTL_SECONDS = 86400;
const IMMUTABLE_BROWSER_TTL_SECONDS = 3600;

const GITHUB_RELEASE_ARTIFACT_PATTERN =
  /\.(?:tgz|whl|jar|zip|gem|crate|deb|rpm|nupkg|tar\.gz|tar\.bz2|tar\.xz)(?:$|[?#])/i;
const MAVEN_ARTIFACT_PATTERN = /\.(?:jar|pom|war|aar|module)(?:$|[?#])/i;
const PYPI_FILE_ARTIFACT_PATTERN = /\.(?:whl|zip|tar\.gz|tar\.bz2|tar\.xz)(?:$|[?#])/i;
const MOVING_VERSION_ALIASES = new Set([
  'current',
  'dev',
  'edge',
  'latest',
  'main',
  'master',
  'nightly',
  'snapshot',
  'stable'
]);

/**
 * Extracts a pathname from either a request path or an absolute URL.
 * @param {string} value Request path or target URL.
 * @returns {string} URL pathname without query or fragment.
 */
function getPathname(value) {
  try {
    return new URL(value).pathname;
  } catch {
    return value.split(/[?#]/, 1)[0] || '';
  }
}

/**
 * Extracts the last path segment from a pathname.
 * @param {string} pathname URL or request pathname.
 * @returns {string} Last segment without percent encoding.
 */
function getBasename(pathname) {
  const basename = pathname.split('/').filter(Boolean).at(-1) || '';
  try {
    return decodeURIComponent(basename);
  } catch {
    return basename;
  }
}

/**
 * Checks whether a segment contains an explicit version instead of a moving alias.
 * @param {string} value Path segment or file stem.
 * @returns {boolean} True when the value contains a version-like token.
 */
function hasVersionLikeToken(value) {
  const normalized = value.toLowerCase();
  if (MOVING_VERSION_ALIASES.has(normalized)) {
    return false;
  }

  return /(?:^|[-_.])v?\d/.test(normalized);
}

/**
 * Reads the tag segment from a GitHub releases/download path.
 * @param {string} pathname URL or request pathname.
 * @returns {string | null} Release tag segment when present.
 */
function getGithubReleaseDownloadTag(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  const releasesIndex = segments.findIndex(
    (segment, index) => segment === 'releases' && segments[index + 1] === 'download'
  );

  if (releasesIndex === -1) {
    return null;
  }

  const tag = segments[releasesIndex + 2];
  if (!tag) {
    return null;
  }

  try {
    return decodeURIComponent(tag);
  } catch {
    return tag;
  }
}

/**
 * Checks whether a GitHub request targets a release asset instead of a branch archive.
 * @param {string} effectivePath Normalized request path.
 * @param {string} targetPath Upstream target path.
 * @returns {boolean} True for release asset downloads.
 */
function isGithubReleaseArtifact(effectivePath, targetPath) {
  const effectiveTag = getGithubReleaseDownloadTag(effectivePath);
  const targetTag = getGithubReleaseDownloadTag(targetPath);

  return (
    (effectivePath.includes('/releases/download/') || targetPath.includes('/releases/download/')) &&
    (GITHUB_RELEASE_ARTIFACT_PATTERN.test(effectivePath) ||
      GITHUB_RELEASE_ARTIFACT_PATTERN.test(targetPath)) &&
    ((effectiveTag !== null && hasVersionLikeToken(effectiveTag)) ||
      (targetTag !== null && hasVersionLikeToken(targetTag)))
  );
}

/**
 * Checks whether an npm path points to a package tarball.
 * @param {string} pathname URL or request pathname.
 * @returns {boolean} True for npm tarball requests.
 */
function isNpmTarballPath(pathname) {
  return /^\/(?:npm\/)?(?:@[^/]+\/)?[^/]+\/-\/[^/]+\.tgz$/i.test(pathname);
}

/**
 * Checks whether a Maven path contains a non-SNAPSHOT versioned artifact.
 * @param {string} pathname URL or request pathname.
 * @returns {boolean} True for Maven release artifacts.
 */
function isMavenReleaseArtifactPath(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 4 || !MAVEN_ARTIFACT_PATTERN.test(pathname)) {
    return false;
  }

  const version = segments.at(-2) || '';
  return /\d/.test(version) && !version.toUpperCase().includes('SNAPSHOT');
}

/**
 * Checks whether a PyPI file path points to a versioned distribution artifact.
 * @param {string} pathname URL or request pathname.
 * @returns {boolean} True for versioned PyPI file artifacts.
 */
function isVersionedPyPIFilePath(pathname) {
  if (!PYPI_FILE_ARTIFACT_PATTERN.test(pathname)) {
    return false;
  }

  const basename = getBasename(pathname);
  const stem = basename.replace(/\.(?:whl|zip|tar\.gz|tar\.bz2|tar\.xz)$/i, '');

  return hasVersionLikeToken(stem);
}

/**
 * Checks whether a request points to an explicitly immutable package or release artifact.
 * @param {string} platform Platform key.
 * @param {string} effectivePath Normalized request path.
 * @param {string} targetUrl Upstream target URL.
 * @returns {boolean} True when the resource can use long-lived immutable caching.
 */
export function isImmutableArtifactRequest(platform, effectivePath, targetUrl) {
  const effectivePathname = getPathname(effectivePath);
  const targetPathname = getPathname(targetUrl);

  if (platform === 'npm') {
    return isNpmTarballPath(effectivePathname) || isNpmTarballPath(targetPathname);
  }

  if (platform === 'pypi-files') {
    return isVersionedPyPIFilePath(effectivePathname) || isVersionedPyPIFilePath(targetPathname);
  }

  if (platform === 'maven') {
    return (
      isMavenReleaseArtifactPath(effectivePathname) || isMavenReleaseArtifactPath(targetPathname)
    );
  }

  if (platform === 'crates') {
    return effectivePathname.endsWith('.crate') || targetPathname.endsWith('.crate');
  }

  if (platform === 'rubygems') {
    return effectivePathname.endsWith('.gem') || targetPathname.endsWith('.gem');
  }

  if (platform === 'gh') {
    return isGithubReleaseArtifact(effectivePathname, targetPathname);
  }

  return false;
}

/**
 * Checks whether an npm path points to rewritten package metadata instead of tarball content.
 * @param {string} effectivePath Normalized request path.
 * @returns {boolean} True when npm response rewriting can bind content to request origin.
 */
function isNpmMetadataPath(effectivePath) {
  return effectivePath.startsWith('/npm/') && !isImmutableArtifactRequest('npm', effectivePath, '');
}

/**
 * Checks whether the cache key must include the request origin because response rewriting embeds it.
 * @param {string} platform Platform key.
 * @param {string} effectivePath Normalized request path.
 * @returns {boolean} True when the generated response varies by request origin.
 */
export function shouldVaryCacheByOrigin(platform, effectivePath) {
  return (
    (platform === 'flathub' && isFlatpakReferenceFilePath(effectivePath)) ||
    (platform === 'npm' && isNpmMetadataPath(effectivePath))
  );
}

/**
 * Checks whether a request targets mutable metadata or package index resources.
 * @param {string} platform Platform key.
 * @param {string} effectivePath Normalized request path.
 * @returns {boolean} True when freshness should be preferred over hit ratio.
 */
function isMetadataOrIndexPath(platform, effectivePath) {
  if (platform === 'npm') {
    return isNpmMetadataPath(effectivePath);
  }

  if (platform === 'pypi') {
    return effectivePath.startsWith('/pypi/simple/') || effectivePath === '/pypi/simple';
  }

  if (platform === 'maven') {
    return effectivePath.endsWith('/maven-metadata.xml');
  }

  if (platform === 'flathub') {
    return (
      effectivePath === '/flathub/repo/summary' || effectivePath === '/flathub/repo/summary.sig'
    );
  }

  return false;
}

/**
 * Builds a shared-cache Cache-Control value.
 * @param {number} browserTtl Browser max-age in seconds.
 * @param {number} edgeTtl Shared cache max-age in seconds.
 * @param {boolean} immutable Whether the response is immutable.
 * @returns {string} Cache-Control header value.
 */
function buildPublicCacheControl(browserTtl, edgeTtl, immutable) {
  const directives = ['public', `max-age=${browserTtl}`, `s-maxage=${edgeTtl}`];

  if (immutable) {
    directives.push('immutable');
  } else {
    directives.push('must-revalidate');
  }

  return directives.join(', ');
}

/**
 * Resolves cache behavior for a proxied request/response.
 * @param {{
 *   canUseCache: boolean,
 *   config: import('../config/index.js').ApplicationConfig,
 *   effectivePath: string,
 *   hasOriginBoundRewrite?: boolean,
 *   hasSensitiveHeaders: boolean,
 *   platform: string,
 *   request: Request,
 *   requestContext: {
 *     isAI: boolean,
 *     isDocker: boolean,
 *     isGit: boolean,
 *     isGitLFS: boolean,
 *     isHF: boolean
 *   },
 *   targetUrl: string
 * }} options
 * @returns {{
 *   allowCacheApi: boolean,
 *   allowFetchCache: boolean,
 *   browserTtl: number,
 *   cacheControl: string,
 *   edgeTtl: number,
 *   mode: 'bypass' | 'edge' | 'private',
 *   varyByOrigin: boolean
 * }} Cache policy.
 */
export function resolveCachePolicy({
  canUseCache,
  config,
  effectivePath,
  hasOriginBoundRewrite = false,
  hasSensitiveHeaders,
  platform,
  request,
  requestContext,
  targetUrl
}) {
  const isProtocolRequest =
    requestContext.isGit ||
    requestContext.isGitLFS ||
    requestContext.isDocker ||
    requestContext.isAI ||
    requestContext.isHF;

  if (hasSensitiveHeaders) {
    return {
      allowCacheApi: false,
      allowFetchCache: false,
      browserTtl: 0,
      cacheControl: 'private, no-store',
      edgeTtl: 0,
      mode: 'private',
      varyByOrigin: false
    };
  }

  if (!canUseCache || isProtocolRequest || hasOriginBoundRewrite) {
    return {
      allowCacheApi: false,
      allowFetchCache: false,
      browserTtl: 0,
      cacheControl: 'no-store',
      edgeTtl: 0,
      mode: 'bypass',
      varyByOrigin: false
    };
  }

  if (isImmutableArtifactRequest(platform, effectivePath, targetUrl)) {
    return {
      allowCacheApi: request.method === 'GET',
      allowFetchCache: true,
      browserTtl: IMMUTABLE_BROWSER_TTL_SECONDS,
      cacheControl: buildPublicCacheControl(
        IMMUTABLE_BROWSER_TTL_SECONDS,
        IMMUTABLE_EDGE_TTL_SECONDS,
        true
      ),
      edgeTtl: IMMUTABLE_EDGE_TTL_SECONDS,
      mode: 'edge',
      varyByOrigin: shouldVaryCacheByOrigin(platform, effectivePath)
    };
  }

  if (isMetadataOrIndexPath(platform, effectivePath)) {
    return {
      allowCacheApi: request.method === 'GET',
      allowFetchCache: true,
      browserTtl: 0,
      cacheControl: buildPublicCacheControl(0, METADATA_EDGE_TTL_SECONDS, false),
      edgeTtl: METADATA_EDGE_TTL_SECONDS,
      mode: 'edge',
      varyByOrigin: shouldVaryCacheByOrigin(platform, effectivePath)
    };
  }

  const fallbackEdgeTtl = Number.isFinite(config.CACHE_DURATION)
    ? config.CACHE_DURATION
    : MUTABLE_EDGE_TTL_SECONDS;

  return {
    allowCacheApi: request.method === 'GET',
    allowFetchCache: true,
    browserTtl: 0,
    cacheControl: buildPublicCacheControl(0, fallbackEdgeTtl, false),
    edgeTtl: fallbackEdgeTtl,
    mode: 'edge',
    varyByOrigin: shouldVaryCacheByOrigin(platform, effectivePath)
  };
}

/**
 * Checks whether a Cache-Control response header contains a directive.
 * @param {string} cacheControl Cache-Control header value.
 * @param {string} directive Directive name.
 * @returns {boolean} True when the directive is present.
 */
function hasCacheControlDirective(cacheControl, directive) {
  return cacheControl
    .split(',')
    .map(part => part.trim().toLowerCase().split('=', 1)[0])
    .includes(directive);
}

/**
 * Safely reads a response header from standard or test double header objects.
 * @param {Headers} headers Response headers.
 * @param {string} name Header name.
 * @returns {string | null} Header value when available.
 */
function getHeaderValue(headers, name) {
  try {
    return typeof headers.get === 'function' ? headers.get(name) : null;
  } catch {
    return null;
  }
}

/**
 * Safely checks header presence from standard or test double header objects.
 * @param {Headers} headers Response headers.
 * @param {string} name Header name.
 * @returns {boolean} True when the header is present.
 */
function hasHeaderValue(headers, name) {
  try {
    if (typeof headers.has === 'function') {
      return headers.has(name);
    }
  } catch {
    return false;
  }

  return getHeaderValue(headers, name) !== null;
}

/**
 * Applies upstream response privacy directives to a request-level cache policy.
 * @param {{
 *   basePolicy: ReturnType<typeof resolveCachePolicy>,
 *   response: Response
 * }} options
 * @returns {ReturnType<typeof resolveCachePolicy>} Response-aware cache policy.
 */
export function resolveResponseCachePolicy({ basePolicy, response }) {
  if (basePolicy.mode === 'private') {
    return {
      ...basePolicy,
      allowCacheApi: false,
      browserTtl: 0,
      cacheControl: 'private, no-store',
      edgeTtl: 0
    };
  }

  const upstreamCacheControl = getHeaderValue(response.headers, 'Cache-Control') || '';
  const hasPrivateDirective = hasCacheControlDirective(upstreamCacheControl, 'private');
  const hasNoStoreDirective = hasCacheControlDirective(upstreamCacheControl, 'no-store');
  const hasNoCacheDirective = hasCacheControlDirective(upstreamCacheControl, 'no-cache');
  const hasSetCookie = hasHeaderValue(response.headers, 'Set-Cookie');
  const hasVaryStar = getHeaderValue(response.headers, 'Vary')
    ?.split(',')
    .map(value => value.trim())
    .includes('*');

  if (hasSetCookie || hasPrivateDirective) {
    return {
      ...basePolicy,
      allowCacheApi: false,
      browserTtl: 0,
      cacheControl: 'private, no-store',
      edgeTtl: 0,
      mode: 'private'
    };
  }

  if (hasNoStoreDirective || hasNoCacheDirective || hasVaryStar) {
    return {
      ...basePolicy,
      allowCacheApi: false,
      browserTtl: 0,
      cacheControl: 'no-store',
      edgeTtl: 0,
      mode: 'bypass'
    };
  }

  return basePolicy;
}
