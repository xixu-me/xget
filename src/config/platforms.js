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
 * Configuration object mapping platform prefixes to their base URLs.
 *
 * Supports 40+ platforms across multiple categories:
 *
 * **Code Repositories & Version Control:**
 * - `gh` - GitHub (github.com)
 * - `gist` - GitHub Gist (gist.github.com)
 * - `gl` - GitLab (gitlab.com)
 * - `gitea` - Gitea (gitea.com)
 * - `codeberg` - Codeberg (codeberg.org)
 * - `sf` - SourceForge (sourceforge.net)
 * - `aosp` - Android Open Source Project (android.googlesource.com)
 * - `hf` - Hugging Face (huggingface.co)
 * - `civitai` - Civitai (civitai.com)
 *
 * **Package Managers:**
 * - `npm` - Node Package Manager (registry.npmjs.org)
 * - `pypi` - Python Package Index (pypi.org)
 * - `pypi-files` - PyPI file hosting (files.pythonhosted.org)
 * - `conda` - Anaconda packages (repo.anaconda.com)
 * - `conda-community` - Community Conda (conda.anaconda.org)
 * - `maven` - Maven Central (repo1.maven.org)
 * - `apache` - Apache downloads (downloads.apache.org)
 * - `gradle` - Gradle plugins (plugins.gradle.org)
 * - `homebrew` - Homebrew repositories (github.com/Homebrew)
 * - `homebrew-api` - Homebrew API (formulae.brew.sh/api)
 * - `homebrew-bottles` - Homebrew bottles (ghcr.io)
 * - `rubygems` - RubyGems (rubygems.org)
 * - `cran` - R CRAN (cran.r-project.org)
 * - `cpan` - Perl CPAN (cpan.org)
 * - `ctan` - TeX CTAN (tug.ctan.org)
 * - `golang` - Go proxy (proxy.golang.org)
 * - `nuget` - NuGet (api.nuget.org)
 * - `crates` - Rust crates.io (crates.io)
 * - `packagist` - PHP Packagist (repo.packagist.org)
 *
 * **Linux Distributions:**
 * - `debian` - Debian packages (deb.debian.org)
 * - `ubuntu` - Ubuntu archives (archive.ubuntu.com)
 * - `fedora` - Fedora downloads (dl.fedoraproject.org)
 * - `rocky` - Rocky Linux (download.rockylinux.org)
 * - `opensuse` - openSUSE downloads (download.opensuse.org)
 * - `arch` - Arch Linux mirrors (geo.mirror.pkgbuild.com)
 *
 * **Other Resources:**
 * - `arxiv` - arXiv papers (arxiv.org)
 * - `fdroid` - F-Droid Android apps (f-droid.org)
 * - `jenkins` - Jenkins plugins (updates.jenkins.io)
 *
 * **AI Inference Providers (prefix: ip-):**
 * - `ip-openai` - OpenAI API
 * - `ip-anthropic` - Claude API
 * - `ip-gemini` - Google Gemini API
 * - `ip-vertexai` - Google Vertex AI
 * - `ip-cohere` - Cohere API
 * - `ip-mistralai` - Mistral AI
 * - `ip-xai` - X.AI
 * - `ip-githubmodels` - GitHub Models
 * - `ip-nvidiaapi` - NVIDIA API
 * - `ip-perplexity` - Perplexity AI
 * - `ip-braintrust` - Braintrust
 * - `ip-groq` - Groq
 * - `ip-cerebras` - Cerebras
 * - `ip-sambanova` - SambaNova
 * - `ip-siray` - Siray AI
 * - `ip-huggingface` - Hugging Face Inference
 * - `ip-together` - Together AI
 * - `ip-replicate` - Replicate
 * - `ip-fireworks` - Fireworks AI
 * - `ip-nebius` - Nebius AI
 * - `ip-jina` - Jina AI
 * - `ip-voyageai` - Voyage AI
 * - `ip-falai` - Fal AI
 * - `ip-novita` - Novita AI
 * - `ip-burncloud` - BurnCloud AI
 * - `ip-openrouter` - OpenRouter
 * - `ip-poe` - Poe
 * - `ip-featherlessai` - Featherless AI
 * - `ip-hyperbolic` - Hyperbolic
 *
 * **Container Registries (prefix: cr-):**
 * - `cr-docker` - Docker Hub (registry-1.docker.io)
 * - `cr-quay` - Quay.io
 * - `cr-gcr` - Google Container Registry
 * - `cr-mcr` - Microsoft Container Registry
 * - `cr-ecr` - AWS Elastic Container Registry (public)
 * - `cr-ghcr` - GitHub Container Registry
 * - `cr-gitlab` - GitLab Container Registry
 * - `cr-redhat` - Red Hat Registry
 * - `cr-oracle` - Oracle Container Registry
 * - `cr-cloudsmith` - Cloudsmith Docker Registry
 * - `cr-digitalocean` - DigitalOcean Container Registry
 * - `cr-vmware` - VMware Harbor
 * - `cr-k8s` - Kubernetes Registry
 * - `cr-heroku` - Heroku Container Registry
 * - `cr-suse` - SUSE Registry
 * - `cr-opensuse` - openSUSE Registry
 * - `cr-gitpod` - Gitpod Registry
 * @type {{ [key: string]: string }}
 * @example
 * // Access GitHub base URL
 * const githubUrl = PLATFORMS.gh; // 'https://github.com'
 * @example
 * // Access OpenAI API base URL
 * const openaiUrl = PLATFORMS['ip-openai']; // 'https://api.openai.com'
 * @example
 * // Check if platform exists
 * if (PLATFORMS.npm) {
 *   console.log('npm registry available');
 * }
 */
export const PLATFORMS = {
  // Code Repositories & Version Control
  gh: 'https://github.com',
  gist: 'https://gist.github.com',
  gl: 'https://gitlab.com',
  gitea: 'https://gitea.com',
  codeberg: 'https://codeberg.org',
  sf: 'https://sourceforge.net',
  aosp: 'https://android.googlesource.com',
  hf: 'https://huggingface.co',
  civitai: 'https://civitai.com',

  // Package Managers
  npm: 'https://registry.npmjs.org',
  pypi: 'https://pypi.org',
  'pypi-files': 'https://files.pythonhosted.org',
  conda: 'https://repo.anaconda.com',
  'conda-community': 'https://conda.anaconda.org',
  maven: 'https://repo1.maven.org',
  apache: 'https://downloads.apache.org',
  gradle: 'https://plugins.gradle.org',
  homebrew: 'https://github.com/Homebrew',
  'homebrew-api': 'https://formulae.brew.sh/api',
  'homebrew-bottles': 'https://ghcr.io',
  rubygems: 'https://rubygems.org',
  cran: 'https://cran.r-project.org',
  cpan: 'https://www.cpan.org',
  ctan: 'https://tug.ctan.org',
  golang: 'https://proxy.golang.org',
  nuget: 'https://api.nuget.org',
  crates: 'https://crates.io',
  packagist: 'https://repo.packagist.org',

  // Linux Distributions
  debian: 'https://deb.debian.org',
  ubuntu: 'https://archive.ubuntu.com',
  fedora: 'https://dl.fedoraproject.org',
  rocky: 'https://download.rockylinux.org',
  opensuse: 'https://download.opensuse.org',
  arch: 'https://geo.mirror.pkgbuild.com',

  // Other Resources
  arxiv: 'https://arxiv.org',
  fdroid: 'https://f-droid.org',
  jenkins: 'https://updates.jenkins.io',

  // AI Inference Providers
  'ip-openai': 'https://api.openai.com',
  'ip-anthropic': 'https://api.anthropic.com',
  'ip-gemini': 'https://generativelanguage.googleapis.com',
  'ip-vertexai': 'https://aiplatform.googleapis.com',
  'ip-cohere': 'https://api.cohere.ai',
  'ip-mistralai': 'https://api.mistral.ai',
  'ip-xai': 'https://api.x.ai',
  'ip-githubmodels': 'https://models.github.ai',
  'ip-nvidiaapi': 'https://integrate.api.nvidia.com',
  'ip-perplexity': 'https://api.perplexity.ai',
  'ip-braintrust': 'https://api.braintrust.dev',
  'ip-groq': 'https://api.groq.com',
  'ip-cerebras': 'https://api.cerebras.ai',
  'ip-sambanova': 'https://api.sambanova.ai',
  'ip-siray': 'https://api.siray.ai',
  'ip-huggingface': 'https://router.huggingface.co',
  'ip-together': 'https://api.together.xyz',
  'ip-replicate': 'https://api.replicate.com',
  'ip-fireworks': 'https://api.fireworks.ai',
  'ip-nebius': 'https://api.studio.nebius.ai',
  'ip-jina': 'https://api.jina.ai',
  'ip-voyageai': 'https://api.voyageai.com',
  'ip-falai': 'https://fal.run',
  'ip-novita': 'https://api.novita.ai',
  'ip-burncloud': 'https://ai.burncloud.com',
  'ip-openrouter': 'https://openrouter.ai',
  'ip-poe': 'https://api.poe.com',
  'ip-featherlessai': 'https://api.featherless.ai',
  'ip-hyperbolic': 'https://api.hyperbolic.xyz',

  // Container Registries
  'cr-docker': 'https://registry-1.docker.io',
  'cr-quay': 'https://quay.io',
  'cr-gcr': 'https://gcr.io',
  'cr-mcr': 'https://mcr.microsoft.com',
  'cr-ecr': 'https://public.ecr.aws',
  'cr-ghcr': 'https://ghcr.io',
  'cr-gitlab': 'https://registry.gitlab.com',
  'cr-redhat': 'https://registry.redhat.io',
  'cr-oracle': 'https://container-registry.oracle.com',
  'cr-cloudsmith': 'https://docker.cloudsmith.io',
  'cr-digitalocean': 'https://registry.digitalocean.com',
  'cr-vmware': 'https://projects.registry.vmware.com',
  'cr-k8s': 'https://registry.k8s.io',
  'cr-heroku': 'https://registry.heroku.com',
  'cr-suse': 'https://registry.suse.com',
  'cr-opensuse': 'https://registry.opensuse.org',
  'cr-gitpod': 'https://registry.gitpod.io'
};

/**
 * Pre-computed sorted platforms keys for efficient matching.
 * Sorted by key length (descending) to prioritize more specific paths.
 */
export const SORTED_PLATFORMS = Object.keys(PLATFORMS).sort((a, b) => {
  const pathA = `/${a.replace('-', '/')}/`;
  const pathB = `/${b.replace('-', '/')}/`;
  return pathB.length - pathA.length;
});

/**
 * Unified path transformation function that converts request paths to platform-specific URLs.
 *
 * This function performs two primary operations:
 * 1. Strips the platform prefix from the request path
 * 2. Applies platform-specific transformations (crates.io, Homebrew, Jenkins)
 *
 * The function handles special cases for platforms that require API path prefixes or
 * URL structure modifications to match their upstream API conventions.
 * @param {string} path - The original request path including platform prefix (e.g., '/gh/user/repo')
 * @param {string} platformKey - The platform key from PLATFORMS object (e.g., 'gh', 'crates', 'npm')
 * @returns {string} The transformed path ready for upstream request
 * @example
 * // Basic transformation - strips platform prefix
 * transformPath('/gh/torvalds/linux', 'gh')
 * // Returns: '/torvalds/linux'
 * @example
 * // crates.io API transformation - adds API prefix
 * transformPath('/crates/serde/1.0.0/download', 'crates')
 * // Returns: '/api/v1/crates/serde/1.0.0/download'
 * @example
 * // crates.io search endpoint
 * transformPath('/crates/?q=tokio', 'crates')
 * // Returns: '/api/v1/crates?q=tokio'
 * @example
 * // Jenkins update center transformation
 * transformPath('/jenkins/update-center.json', 'jenkins')
 * // Returns: '/current/update-center.json'
 * @example
 * // Homebrew API paths (pass-through)
 * transformPath('/homebrew/api/formula/git.json', 'homebrew-api')
 * // Returns: '/formula/git.json'
 * @example
 * // Unknown platform (no transformation)
 * transformPath('/unknown/path', 'nonexistent')
 * // Returns: '/unknown/path'
 * @example
 * // Multi-part platform key (hyphens converted to slashes)
 * transformPath('/ip/openai/v1/chat/completions', 'ip-openai')
 * // Returns: '/v1/chat/completions'
 */
export function transformPath(path, platformKey) {
  // Return original path if platform doesn't exist
  if (!PLATFORMS[platformKey]) {
    return path;
  }

  // Convert platform key to path prefix (e.g., 'ip-openai' -> '/ip/openai/')
  const prefix = `/${platformKey.replace(/-/g, '/')}/`;
  let transformedPath = path.replace(
    new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    '/'
  );

  /**
   * Special handling for crates.io API paths
   *
   * The Rust package registry requires an `/api/v1/crates` prefix for all API endpoints.
   * This transformation adds the necessary prefix to match crates.io's API structure.
   *
   * Transformations:
   * - `/serde/1.0.0/download` -> `/api/v1/crates/serde/1.0.0/download`
   * - `/serde` -> `/api/v1/crates/serde`
   * - `/?q=query` -> `/api/v1/crates?q=query`
   */
  if (platformKey === 'crates') {
    if (transformedPath.startsWith('/')) {
      if (transformedPath === '/' || transformedPath.startsWith('/?')) {
        // Search endpoint: /?q=query -> /api/v1/crates?q=query
        transformedPath = transformedPath.replace('/', '/api/v1/crates');
      } else {
        // Crate-specific endpoints: /serde -> /api/v1/crates/serde
        transformedPath = `/api/v1/crates${transformedPath}`;
      }
    }
  }

  /**
   * Special handling for Homebrew API paths
   *
   * Homebrew API paths are already in the correct format (e.g., /formula/git.json),
   * so we simply strip the prefix and return the path as-is.
   *
   * Supported endpoints:
   * - `/formula/{name}.json` - Formula metadata
   * - `/cask/{name}.json` - Cask metadata
   */
  if (platformKey === 'homebrew-api') {
    if (transformedPath.startsWith('/')) {
      return transformedPath;
    }
  }

  /**
   * Special handling for Homebrew bottles
   *
   * Homebrew bottles are served from GitHub Container Registry (ghcr.io).
   * The paths follow OCI registry format (/v2/...) and are passed through as-is.
   *
   * Example: `/v2/homebrew/core/git/manifests/2.39.0`
   */
  if (platformKey === 'homebrew-bottles') {
    if (transformedPath.startsWith('/')) {
      return transformedPath;
    }
  }

  /**
   * Special handling for Jenkins plugins
   *
   * Jenkins update center requires paths to be prefixed with `/current/` for
   * the default update center. Experimental and download paths are preserved.
   *
   * Transformations:
   * - `/update-center.json` -> `/current/update-center.json`
   * - `/update-center.actual.json` -> `/current/update-center.actual.json`
   * - `/experimental/...` -> `/experimental/...` (preserved)
   * - `/download/...` -> `/download/...` (preserved)
   * - Other paths -> `/current/{path}`
   */
  if (platformKey === 'jenkins') {
    if (transformedPath.startsWith('/')) {
      if (transformedPath === '/update-center.json') {
        return '/current/update-center.json';
      } else if (transformedPath === '/update-center.actual.json') {
        return '/current/update-center.actual.json';
      } else if (
        transformedPath.startsWith('/experimental/') ||
        transformedPath.startsWith('/download/') ||
        transformedPath.startsWith('/current/')
      ) {
        // Keep experimental, download, and current paths as-is
        return transformedPath;
      } else {
        // For other paths, assume they are relative to current
        return `/current${transformedPath}`;
      }
    }
  }

  /**
   * Special handling for Homebrew repositories
   *
   * Homebrew repositories are Git repos on GitHub (github.com/Homebrew).
   * Paths are passed through as-is to access repos like homebrew-core, homebrew-cask.
   *
   * Example: `/brew`, `/homebrew-core`, `/homebrew-cask`
   */
  if (platformKey === 'homebrew') {
    if (transformedPath.startsWith('/')) {
      return transformedPath;
    }
  }

  return transformedPath;
}
