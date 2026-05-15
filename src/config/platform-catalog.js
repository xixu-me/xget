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

/**
 * Platform base URLs used by request routing.
 * @type {{ [key: string]: string }}
 */
export const PLATFORM_CATALOG = {
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
  flathub: 'https://dl.flathub.org',

  // Linux Distributions
  debian: 'https://deb.debian.org',
  ubuntu: 'https://archive.ubuntu.com',
  fedora: 'https://mirrors.kernel.org/fedora',
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
  'ip-atlascloud': 'https://api.atlascloud.ai',

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

export const PLATFORMS = PLATFORM_CATALOG;
