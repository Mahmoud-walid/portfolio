import { unstable_cache } from 'next/cache';
import data from '../data.json';

const revalidate = 60;
const MINUTES_5 = 60 * 5;
const HOURS_1 = 60 * 60;
const HOURS_6 = 60 * 60 * 6;
const HOURS_12 = 60 * 60 * 12;
const HOURS_24 = 60 * 60 * 24;
const GITHUB_API_URL = 'https://api.github.com';
const GITHUB_GRAPHQL_URL = `${GITHUB_API_URL}/graphql`;
const AGENT_GRAPHQL_BATCH_SIZE = 10;
const EXTERNAL_FETCH_TIMEOUT_MS = 10_000;
const PROJECT_ENRICHMENT_CONCURRENCY = 5;
const PORTFOLIO_OWNER_USERNAME =
  process.env.GITHUB_USERNAME || data.githubUsername;

interface FetchOptions {
  context?: string;
  fallback?: any;
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  next?: any;
}

function cloneFallbackValue<T>(fallback: T): T {
  if (
    fallback === null ||
    fallback === undefined ||
    typeof fallback !== 'object'
  ) {
    return fallback;
  }

  return structuredClone(fallback);
}

function getGitHubHeaders(
  extraHeaders: Record<string, string> = {},
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    ...extraHeaders,
  };

  if (process.env.GH_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
  }

  return headers;
}

async function parseJsonResponse(
  res: Response,
  context: string,
  fallback: any,
) {
  try {
    return await res.json();
  } catch (error) {
    console.error(`Failed to parse JSON for ${context}:`, error);
    return cloneFallbackValue(fallback);
  }
}

async function fetchGitHubResponse(
  url: string,
  {
    context,
    fallback = null,
    method = 'GET',
    body,
    headers,
    next,
  }: FetchOptions = {},
) {
  try {
    const res = await fetch(url, {
      method,
      body,
      headers: getGitHubHeaders(headers),
      next,
      signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
    });
    const contentType = res.headers.get('content-type') || '';
    let payload = cloneFallbackValue(fallback);

    if (contentType.includes('application/json')) {
      payload = await parseJsonResponse(
        res,
        context || 'unknown context',
        fallback,
      );
    } else if (res.ok) {
      console.error(`GitHub API returned a non-JSON response for ${context}.`);
    }

    if (!res.ok) {
      console.error(
        `GitHub API returned an error for ${context}.`,
        res.status,
        res.statusText,
      );
      return {
        ok: false,
        data: cloneFallbackValue(fallback),
        headers: res.headers,
      };
    }

    return { ok: true, data: payload, headers: res.headers };
  } catch (error) {
    console.error(`GitHub API request failed for ${context}:`, error);
    return {
      ok: false,
      data: cloneFallbackValue(fallback),
      headers: new Headers(),
    };
  }
}

async function fetchGitHubJson(url: string, options: FetchOptions) {
  const response = await fetchGitHubResponse(url, options);
  return response.data;
}

async function fetchGitHubGraphQL(
  query: string,
  variables: any,
  { context, fallback = null, next }: FetchOptions = {},
) {
  const response = await fetchGitHubResponse(GITHUB_GRAPHQL_URL, {
    context,
    fallback,
    method: 'POST',
    next,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    return cloneFallbackValue(fallback);
  }

  if (response.data?.errors) {
    console.error(
      `GitHub GraphQL returned an error for ${context}.`,
      response.data.errors,
    );
    return cloneFallbackValue(fallback);
  }

  return response.data?.data ?? cloneFallbackValue(fallback);
}

function hasNextPage(linkHeader?: string | null): boolean {
  return Boolean(
    linkHeader?.split(',').some((link) => link.includes('rel="next"')),
  );
}

async function fetchPaginatedGitHubArray(
  initialUrl: string,
  { context, next }: FetchOptions = {},
) {
  const items: any[] = [];
  let page = 1;
  let shouldContinue = true;

  while (shouldContinue) {
    const url = new URL(initialUrl);

    if (page > 1) {
      url.searchParams.set('page', page.toString());
    }

    const response = await fetchGitHubResponse(url.toString(), {
      context: `${context} (page ${page})`,
      fallback: [],
      next,
    });

    if (!response.ok) {
      break;
    }

    if (!Array.isArray(response.data)) {
      console.error(
        `GitHub API returned an unexpected payload for ${context} on page ${page}.`,
        {
          payloadType: typeof response.data,
        },
      );
      break;
    }

    items.push(...response.data);
    shouldContinue = hasNextPage(response.headers.get('link'));
    page++;
  }

  return items;
}

function getRepositoryKey(project: any): string {
  return project.full_name ?? `${project.owner?.login}/${project.name}`;
}

function isOwnedRepository(project: any, username: string): boolean {
  return Boolean(
    username &&
    project.owner?.login &&
    project.owner.login.toLowerCase() === username.toLowerCase(),
  );
}

function createEmptyVercelDetails(nextjsLatestRelease: any = {}) {
  return {
    nextjsVersion: '',
    astroVersion: '',
    nextjsLatestVersion: nextjsLatestRelease.tagName || '',
    routerMode: 'none',
    repositoryFrameworks: [],
    isUsingTurbopack: false,
    uiLibraries: [],
  };
}

function chunkItems<T>(items: T[], size: number): T[][] {
  if (!items.length) {
    return [];
  }

  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function getOptionalValue<T>(
  factory: () => Promise<T>,
  fallback: T,
  context: string,
): Promise<T> {
  try {
    return await factory();
  } catch (error) {
    console.error(`Failed to fetch optional data for ${context}:`, error);
    return cloneFallbackValue(fallback);
  }
}

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  if (!items.length) {
    return [];
  }

  const results: U[] = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex++;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function buildCopilotRepoSearchQuery(
  username: string,
  reponame: string,
): string | null {
  if (typeof username !== 'string' || typeof reponame !== 'string') {
    return null;
  }

  if (
    !/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username) ||
    !/^[a-zA-Z0-9._-]{1,100}$/.test(reponame)
  ) {
    return null;
  }

  return `is:pr is:merged author:copilot-swe-agent[bot] involves:${username} repo:${username}/${reponame}`;
}

function buildCopilotAccountSearchQuery(username: string): string | null {
  if (
    typeof username !== 'string' ||
    !/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username)
  ) {
    return null;
  }

  return `is:pr is:merged author:copilot-swe-agent[bot] involves:${username}`;
}

function buildCodexCoauthoredCommitSearchQuery(
  username: string,
): string | null {
  if (
    typeof username !== 'string' ||
    !/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username)
  ) {
    return null;
  }

  return `author:${username} "Co-authored-by: Codex"`;
}

function buildClaudeCoauthoredCommitSearchQuery(
  username: string,
): string | null {
  if (
    typeof username !== 'string' ||
    !/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username)
  ) {
    return null;
  }

  return `author:${username} "Co-authored-by: Claude"`;
}

function buildCodexLabeledAccountSearchQuery(username: string): string | null {
  if (
    typeof username !== 'string' ||
    !/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username)
  ) {
    return null;
  }

  return `is:pr is:merged author:${username} label:codex`;
}

function buildClaudeLabeledAccountSearchQuery(username: string): string | null {
  if (
    typeof username !== 'string' ||
    !/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username)
  ) {
    return null;
  }

  return `is:pr is:merged author:${username} label:claude`;
}

function buildCodexLabeledPRRepoSearchQuery(
  username: string,
  reponame: string,
): string | null {
  if (typeof username !== 'string' || typeof reponame !== 'string') {
    return null;
  }

  if (
    !/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username) ||
    !/^[a-zA-Z0-9._-]{1,100}$/.test(reponame)
  ) {
    return null;
  }

  return `is:pr is:merged author:${username} label:codex repo:${username}/${reponame}`;
}

function buildClaudeLabeledPRRepoSearchQuery(
  username: string,
  reponame: string,
): string | null {
  if (typeof username !== 'string' || typeof reponame !== 'string') {
    return null;
  }

  if (
    !/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username) ||
    !/^[a-zA-Z0-9._-]{1,100}$/.test(reponame)
  ) {
    return null;
  }

  return `is:pr is:merged author:${username} label:claude repo:${username}/${reponame}`;
}

export const getUser = unstable_cache(
  async (username: string) => {
    console.log('Fetching user data for', username);
    const response = await fetchGitHubJson(
      `${GITHUB_API_URL}/users/${username}`,
      {
        context: `user data for ${username}`,
        fallback: {},
      },
    );
    return response;
  },
  ['getUser'],
  { revalidate },
);

export const getRepos = unstable_cache(
  async (username: string) => {
    console.log('Fetching repos for', username);
    const response = await fetchPaginatedGitHubArray(
      `${GITHUB_API_URL}/users/${username}/repos?per_page=100`,
      {
        context: `repositories for ${username}`,
      },
    );
    return response;
  },
  ['getRepos'],
  { revalidate: HOURS_1 },
);

export const getSocialAccounts = unstable_cache(
  async (username: string) => {
    console.log('Fetching social accounts for', username);
    const response = await fetchGitHubJson(
      `${GITHUB_API_URL}/users/${username}/social_accounts`,
      {
        context: `social accounts for ${username}`,
        fallback: [],
      },
    );
    return Array.isArray(response) ? response : [];
  },
  ['getSocialAccounts'],
  { revalidate: HOURS_12 },
);

export const getPinnedRepos = unstable_cache(
  async (username: string) => {
    console.log('Fetching pinned repos for', username);
    const pinned = await fetchGitHubGraphQL(
      `
        query GetPinnedRepos($username: String!) {
            user(login: $username) {
                pinnedItems(first: 6, types: REPOSITORY) {
                    nodes {
                        ... on Repository {
                            name
                        }
                    }
                }
            }
        }
    `,
      { username },
      {
        context: `pinned repositories for ${username}`,
        fallback: { user: { pinnedItems: { nodes: [] } } },
      },
    );
    return (
      pinned.user?.pinnedItems?.nodes
        ?.map((node: any) => node?.name)
        .filter(Boolean) ?? []
    );
  },
  ['getPinnedRepos'],
  { revalidate: HOURS_12 },
);

export const getUserOrganizations = unstable_cache(
  async (username: string) => {
    console.log('Fetching organizations for', username);
    const orgs = await fetchGitHubGraphQL(
      `
        query GetUserOrganizations($username: String!) {
            user(login: $username) {
                organizations(first: 6) {
                    nodes {
                        name
                        websiteUrl
                        url
                        avatarUrl
                        description
                    }
                }
            }
        }
    `,
      { username },
      {
        context: `organizations for ${username}`,
        fallback: { user: { organizations: { nodes: [] } } },
      },
    );
    return { data: orgs };
  },
  ['getUserOrganizations'],
  { revalidate: HOURS_12 },
);

export const getVercelProjects = unstable_cache(
  async () => {
    if (!process.env.VC_TOKEN) {
      console.log('No Vercel token found - no projects will be shown.');
      return { projects: [] };
    }
    console.log('Fetching Vercel projects');

    const baseUrl = 'https://api.vercel.com/v9/projects';
    const limit = 100;
    let nextCursor: string | null = null;
    let url = `${baseUrl}?limit=${limit}`;
    const allProjects: any[] = [];

    try {
      do {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${process.env.VC_TOKEN}` },
          signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
        });

        if (!res.ok) {
          console.error(
            'Vercel API returned an error.',
            res.status,
            res.statusText,
          );
          return { projects: [] };
        }

        let data;
        try {
          data = await res.json();
        } catch (error) {
          console.error('Failed to parse Vercel API response.', error);
          return { projects: [] };
        }

        allProjects.push(...(data.projects ?? []));
        nextCursor = data.pagination?.next || null;
        url = nextCursor ? `${baseUrl}?limit=${limit}&until=${nextCursor}` : '';
      } while (nextCursor);

      console.log('Vercel projects count:', allProjects.length);
      return { projects: allProjects };
    } catch (error) {
      console.error('Vercel API fetch failed:', error);
      return { projects: [] };
    }
  },
  ['getVercelProjects'],
  { revalidate: HOURS_24 },
);

export const getNextjsLatestRelease = unstable_cache(
  async () => {
    const nextjsLatest = await fetchGitHubGraphQL(
      `
        query GetNextJsLatestRelease($repoName: String!, $owner: String!) {
            repository(name: $repoName, owner: $owner) {
                latestRelease {
                    tagName
                    updatedAt
                }
            }
        }
    `,
      { repoName: 'next.js', owner: 'vercel' },
      {
        context: 'latest Next.js release',
        fallback: { repository: { latestRelease: null } },
      },
    );

    if (!nextjsLatest.repository?.latestRelease) {
      return {};
    }

    return {
      tagName: cleanVersionTag(nextjsLatest.repository.latestRelease.tagName),
      updatedAt: nextjsLatest.repository.latestRelease.updatedAt,
    };
  },
  ['getNextjsLatestRelease'],
  { revalidate: HOURS_6 },
);

function cleanDependencyVersion(versionSpec: string): string {
  if (typeof versionSpec !== 'string') {
    return '';
  }
  return versionSpec.replace(/^[\^~>=<]+/, '');
}

function cleanVersionTag(tagName: string): string {
  if (typeof tagName !== 'string') {
    return '';
  }
  let cleaned = tagName.replace(/^v/, '');
  cleaned = cleaned.replace(/^[^@]*@/, '');
  return cleaned;
}

export const getFrameworkLatestRelease = unstable_cache(
  async (repoName: string, owner: string) => {
    const latest = await fetchGitHubGraphQL(
      `
        query GetFrameworkLatestRelease($repoName: String!, $owner: String!) {
            repository(name: $repoName, owner: $owner) {
                latestRelease {
                    tagName
                    updatedAt
                }
            }
        }
    `,
      { repoName, owner },
      {
        context: `latest release for ${owner}/${repoName}`,
        fallback: { repository: { latestRelease: null } },
      },
    );

    if (!latest.repository?.latestRelease) {
      console.error(`No latest release found for ${owner}/${repoName}`);
      return {};
    }

    return {
      tagName: cleanVersionTag(latest.repository.latestRelease.tagName),
      updatedAt: latest.repository.latestRelease.updatedAt,
    };
  },
  ['getFrameworkLatestRelease'],
  { revalidate: HOURS_6 },
);

export const getAstroLatestRelease = () =>
  getFrameworkLatestRelease('astro', 'withastro');
export const getNuxtLatestRelease = () =>
  getFrameworkLatestRelease('nuxt', 'nuxt');
export const getSvelteKitLatestRelease = () =>
  getFrameworkLatestRelease('kit', 'sveltejs');
export const getRemixLatestRelease = () =>
  getFrameworkLatestRelease('remix', 'remix-run');
export const getGatsbyLatestRelease = () =>
  getFrameworkLatestRelease('gatsby', 'gatsbyjs');

async function fetchRepositoryContentInfo(username: string, reponame: string) {
  const response = await fetchGitHubGraphQL(
    `
        query GetRepositoryContentInfo($owner: String!, $repoName: String!) {
            repository(name: $repoName, owner: $owner) {
                packageJson: object(expression: "HEAD:package.json") {
                    ... on Blob {
                        text
                    }
                }
                pagesAppJsx: object(expression: "HEAD:pages/_app.jsx") {
                    __typename
                }
                pagesAppTsx: object(expression: "HEAD:pages/_app.tsx") {
                    __typename
                }
                appLayoutJsx: object(expression: "HEAD:app/layout.jsx") {
                    __typename
                }
                appLayoutTsx: object(expression: "HEAD:app/layout.tsx") {
                    __typename
                }
            }
        }
    `,
    { owner: username, repoName: reponame },
    {
      context: `repository content info for ${username}/${reponame}`,
      fallback: { repository: null },
    },
  );

  return response.repository;
}

const getRepositoryContentInfo = unstable_cache(
  fetchRepositoryContentInfo,
  ['getRepositoryContentInfo'],
  { revalidate: HOURS_24 },
);

function parseRepositoryPackageJson(
  repository: any,
  username: string,
  reponame: string,
) {
  const packageJsonText = repository?.packageJson?.text;

  if (!packageJsonText) {
    return null;
  }

  try {
    return JSON.parse(packageJsonText);
  } catch (error) {
    console.error(
      `Failed to parse package.json for ${username}/${reponame}:`,
      error,
    );
    return null;
  }
}

function getRouterInfoFromRepository(repository: any) {
  return {
    isRouterPages: Boolean(repository?.pagesAppJsx || repository?.pagesAppTsx),
    isRouterApp: Boolean(repository?.appLayoutJsx || repository?.appLayoutTsx),
  };
}

const getCachedRepositoryRouterInfo = unstable_cache(
  async (repoOwner: string, repoName: string) => {
    const repository = await fetchRepositoryContentInfo(repoOwner, repoName);
    return getRouterInfoFromRepository(repository);
  },
  ['checkAppJsxExistence'],
  { revalidate: HOURS_24 },
);

export async function getRepositoryPackageJson(
  username: string,
  reponame: string,
) {
  const repository = await getRepositoryContentInfo(username, reponame);
  return parseRepositoryPackageJson(repository, username, reponame);
}

export const getRecentUserActivity = unstable_cache(
  async (username: string) => {
    console.log('Fetching recent activity for', username);
    const response = await fetchPaginatedGitHubArray(
      `${GITHUB_API_URL}/users/${username}/events?per_page=100`,
      {
        context: `recent activity for ${username}`,
      },
    );
    return response;
  },
  ['getRecentUserActivity'],
  { revalidate: MINUTES_5 },
);

export const getPublishedReleaseSummary = unstable_cache(
  async (username: string) => {
    let after: string | null = null;
    let releaseCount = 0;
    let repositoryCount = 0;

    do {
      const response = await fetchGitHubGraphQL(
        `
            query GetPublishedReleaseSummary($username: String!, $after: String) {
                user(login: $username) {
                    repositories(
                        first: 100
                        after: $after
                        ownerAffiliations: OWNER
                        privacy: PUBLIC
                    ) {
                        pageInfo {
                            endCursor
                            hasNextPage
                        }
                        nodes {
                            releases(first: 1) {
                                totalCount
                            }
                        }
                    }
                }
            }
        `,
        { username, after },
        {
          context: `published release summary for ${username}`,
          fallback: {
            user: {
              repositories: {
                nodes: [],
                pageInfo: { endCursor: null, hasNextPage: false },
              },
            },
          },
        },
      );

      const repositories = response.user?.repositories;

      for (const repository of repositories?.nodes ?? []) {
        const count = repository?.releases?.totalCount ?? 0;
        releaseCount += count;
        repositoryCount += count > 0 ? 1 : 0;
      }

      after = repositories?.pageInfo?.hasNextPage
        ? repositories.pageInfo.endCursor
        : null;
    } while (after);

    return { releaseCount, repositoryCount };
  },
  ['getPublishedReleaseSummary'],
  { revalidate: HOURS_6 },
);

export const getTrafficPageViews = unstable_cache(
  async (username: string, reponame: string) => {
    const response = await fetchGitHubResponse(
      `${GITHUB_API_URL}/repos/${username}/${reponame}/traffic/views`,
      {
        context: `traffic views for ${username}/${reponame}`,
        fallback: null,
      },
    );

    if (!response.ok || response.data === null || response.data === undefined) {
      return null;
    }

    const sumUniques = response.data.uniques || 0;
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const todayUniques =
      response.data.views?.find((day: any) =>
        day.timestamp.startsWith(yesterday),
      )?.uniques || 0;

    return { sumUniques, todayUniques };
  },
  ['getTrafficPageViews'],
  { revalidate: HOURS_6 },
);

export const getDependabotAlerts = unstable_cache(
  async (username: string, reponame: string) => {
    const response = await fetchGitHubResponse(
      `${GITHUB_API_URL}/repos/${username}/${reponame}/dependabot/alerts`,
      {
        context: `Dependabot alerts for ${username}/${reponame}`,
        fallback: null,
        next: { revalidate: HOURS_12 },
      },
    );

    if (
      !response.ok ||
      response.data === null ||
      response.data === undefined ||
      !Array.isArray(response.data)
    ) {
      return null;
    }

    const openAlertsBySeverity = response.data.reduce(
      (acc: any, alert: any) => {
        if (alert.state === 'open') {
          acc[alert.security_advisory.severity] = acc[
            alert.security_advisory.severity
          ]
            ? acc[alert.security_advisory.severity] + 1
            : 1;
        }
        return acc;
      },
      {},
    );

    return openAlertsBySeverity;
  },
  ['getDependabotAlerts'],
  { revalidate: HOURS_12 },
);

export async function checkAppJsxExistence(
  repoOwner: string,
  repoName: string,
) {
  return getCachedRepositoryRouterInfo(repoOwner, repoName);
}

async function fetchAgentCountChunk(repositories: any[]) {
  const searchableRepositories = repositories.filter((project) => {
    const owner = project.owner?.login;
    return (
      buildCopilotRepoSearchQuery(owner, project.name) &&
      buildCodexLabeledPRRepoSearchQuery(owner, project.name) &&
      buildClaudeLabeledPRRepoSearchQuery(owner, project.name)
    );
  });

  if (!searchableRepositories.length) {
    return { copilot: {}, codex: {}, claude: {} };
  }

  const variableDefinitions = searchableRepositories
    .flatMap((_, index) => [
      `$copilot${index}: String!`,
      `$codex${index}: String!`,
      `$claude${index}: String!`,
    ])
    .join(', ');
  const searches = searchableRepositories
    .map(
      (_, index) => `
        copilot${index}: search(type: ISSUE, query: $copilot${index}, first: 1) {
            issueCount
        }
        codex${index}: search(type: ISSUE, query: $codex${index}, first: 1) {
            issueCount
        }
        claude${index}: search(type: ISSUE, query: $claude${index}, first: 1) {
            issueCount
        }
    `,
    )
    .join('\n');
  const variables: Record<string, string | null> = {};

  searchableRepositories.forEach((project, index) => {
    const owner = project.owner.login;
    variables[`copilot${index}`] = buildCopilotRepoSearchQuery(
      owner,
      project.name,
    );
    variables[`codex${index}`] = buildCodexLabeledPRRepoSearchQuery(
      owner,
      project.name,
    );
    variables[`claude${index}`] = buildClaudeLabeledPRRepoSearchQuery(
      owner,
      project.name,
    );
  });

  const response = await fetchGitHubGraphQL(
    `
        query BatchProjectAgentCounts(${variableDefinitions}) {
            ${searches}
        }
    `,
    variables,
    {
      context: `batched agent counts for ${searchableRepositories.length} repositories`,
      fallback: {},
      next: { revalidate: HOURS_12 },
    },
  );

  return searchableRepositories.reduce(
    (counts: any, project, index) => {
      const key = getRepositoryKey(project);
      counts.copilot[key] = response[`copilot${index}`]?.issueCount ?? null;
      counts.codex[key] = response[`codex${index}`]?.issueCount ?? null;
      counts.claude[key] = response[`claude${index}`]?.issueCount ?? null;
      return counts;
    },
    { copilot: {}, codex: {}, claude: {} },
  );
}

async function getAgentCounts(repositories: any[]) {
  const chunks = await Promise.all(
    chunkItems(repositories, AGENT_GRAPHQL_BATCH_SIZE).map((chunk, index) =>
      getOptionalValue(
        () => fetchAgentCountChunk(chunk),
        { copilot: {}, codex: {}, claude: {} },
        `agent count batch ${index + 1}`,
      ),
    ),
  );

  return chunks.reduce(
    (counts, chunkResult) => {
      Object.assign(counts.copilot, chunkResult.copilot);
      Object.assign(counts.codex, chunkResult.codex);
      Object.assign(counts.claude, chunkResult.claude);
      return counts;
    },
    { copilot: {}, codex: {}, claude: {} },
  );
}

function getPackageDependencyVersion(packageJson: any, dependency: string) {
  const version =
    packageJson?.dependencies?.[dependency] ??
    packageJson?.devDependencies?.[dependency];
  return cleanDependencyVersion(version);
}

function getRouterMode({
  isRouterPages,
  isRouterApp,
}: {
  isRouterPages: boolean;
  isRouterApp: boolean;
}) {
  if (isRouterPages && isRouterApp) return 'hybrid';
  if (isRouterApp) return 'app';
  if (isRouterPages) return 'pages';
  return 'none';
}

function getRepositoryUiLibraries(packageJson: any) {
  const libraries: string[] = [];

  if (
    packageJson?.devDependencies?.tailwindcss ||
    packageJson?.dependencies?.tailwindcss
  ) {
    libraries.push('tailwindcss');
  }
  if (packageJson?.dependencies?.['react-bootstrap']) {
    libraries.push('react-bootstrap');
  }
  if (packageJson?.dependencies?.['@primer/react']) {
    libraries.push('primer');
  }

  return libraries;
}

async function getRepositoryVercelDetails(
  username: string,
  reponame: string,
  nextjsLatestRelease: any,
) {
  try {
    const repository = await getRepositoryContentInfo(username, reponame);
    const packageJson = parseRepositoryPackageJson(
      repository,
      username,
      reponame,
    );
    const routerInfo = getRouterInfoFromRepository(repository);
    const repositoryFrameworks = await getFrameworkDetails(packageJson);
    const nextjsVersion = getPackageDependencyVersion(packageJson, 'next');
    const astroVersion = getPackageDependencyVersion(packageJson, 'astro');
    const isNext16 =
      nextjsVersion && compareVersions(nextjsVersion, '16.0.0') >= 0;

    return {
      nextjsVersion,
      astroVersion,
      nextjsLatestVersion: nextjsLatestRelease.tagName || '',
      routerMode: getRouterMode(routerInfo),
      repositoryFrameworks: repositoryFrameworks.map((framework: any) => ({
        name: framework.name,
        type: framework.type,
        version: framework.version,
        latestVersion: framework.latestVersion,
        hasUpgrade: framework.hasUpgrade,
      })),
      isUsingTurbopack: Boolean(
        isNext16 ||
        packageJson?.scripts?.dev?.includes('--turbo') ||
        packageJson?.scripts?.dev?.includes('--turbopack'),
      ),
      uiLibraries: getRepositoryUiLibraries(packageJson),
    };
  } catch (error) {
    console.error(
      `Failed to enrich Vercel data for ${username}/${reponame}:`,
      error,
    );
    return createEmptyVercelDetails(nextjsLatestRelease);
  }
}

async function enrichProjectsForCards(projects: any[]) {
  const ownerProjects = projects.filter((project) =>
    isOwnedRepository(project, PORTFOLIO_OWNER_USERNAME),
  );
  const hasVercelProjects = projects.some((project) => project.vercel);
  const [agentCounts, nextjsLatestRelease] = await Promise.all([
    getOptionalValue(
      () => getAgentCounts(ownerProjects),
      { copilot: {}, codex: {}, claude: {} },
      'project agent counts',
    ),
    hasVercelProjects
      ? getOptionalValue(
          () => getNextjsLatestRelease(),
          {},
          'latest Next.js release',
        )
      : Promise.resolve({}),
  ]);

  return mapWithConcurrency(
    projects,
    PROJECT_ENRICHMENT_CONCURRENCY,
    async (project: any) => {
      const repoOwner = project.owner?.login;
      const isOwnerRepo = isOwnedRepository(project, PORTFOLIO_OWNER_USERNAME);
      const [views, openAlertsBySeverity, vercelDetails] = await Promise.all([
        isOwnerRepo && repoOwner
          ? getOptionalValue(
              () => getTrafficPageViews(repoOwner, project.name),
              null,
              `traffic for ${repoOwner}/${project.name}`,
            )
          : Promise.resolve(null),
        isOwnerRepo && repoOwner
          ? getOptionalValue(
              () => getDependabotAlerts(repoOwner, project.name),
              null,
              `Dependabot alerts for ${repoOwner}/${project.name}`,
            )
          : Promise.resolve(null),
        project.vercel && repoOwner
          ? getOptionalValue(
              () =>
                getRepositoryVercelDetails(
                  repoOwner,
                  project.name,
                  nextjsLatestRelease,
                ),
              createEmptyVercelDetails(nextjsLatestRelease),
              `Vercel details for ${repoOwner}/${project.name}`,
            )
          : Promise.resolve(null),
      ]);

      return {
        ...project,
        ownerMetrics: {
          isOwnerRepo,
          views,
          openAlertsBySeverity,
          copilotPRCount: isOwnerRepo
            ? (agentCounts.copilot[getRepositoryKey(project)] ?? null)
            : null,
          codexCount: isOwnerRepo
            ? (agentCounts.codex[getRepositoryKey(project)] ?? null)
            : null,
          claudeCount: isOwnerRepo
            ? (agentCounts.claude[getRepositoryKey(project)] ?? null)
            : null,
        },
        vercel: project.vercel
          ? {
              ...project.vercel,
              details:
                vercelDetails ?? createEmptyVercelDetails(nextjsLatestRelease),
            }
          : undefined,
      };
    },
  );
}

export function isPortfolioOwnerUsername(username: string) {
  return (
    typeof username === 'string' &&
    username.toLowerCase() === PORTFOLIO_OWNER_USERNAME.toLowerCase()
  );
}

function selectVisibleProjects(repositories: any[], pinnedNames: any[]) {
  const heroes = repositories
    .filter((project) => pinnedNames.includes(project.name))
    .sort((a, b) => b.stargazers_count - a.stargazers_count);
  const sorted = repositories
    .filter((project) => !project.private)
    .filter((project) => !project.fork)
    .filter((project) => !project.archived)
    .filter((project) => !pinnedNames.includes(project.name))
    .filter(
      (project) => !data.projects.blacklist.includes(project.name as never),
    )
    .sort(
      (a, b) =>
        new Date(b.updated_at ?? Number.POSITIVE_INFINITY).getTime() -
        new Date(a.updated_at ?? Number.POSITIVE_INFINITY).getTime(),
    );

  return { heroes, sorted };
}

function toProjectCardData(project: any) {
  const owner = project.owner?.login || '';

  return {
    full_name: project.full_name || `${owner}/${project.name}`,
    owner: { login: owner },
    name: project.name,
    homepage: project.homepage || '',
    html_url: project.html_url,
    created_at: project.created_at,
    stargazers_count: project.stargazers_count || 0,
    description: project.description || '',
  };
}

function getLinkedGitHubRepositoryKey(vercelProject: any): string | null {
  const link = vercelProject?.link;

  if (!link || (link.type && link.type !== 'github')) {
    return null;
  }

  const owner = link.org || link.owner || link.repoOwner;
  const repository = link.repo;

  if (typeof owner !== 'string' || typeof repository !== 'string') {
    return null;
  }

  return `${owner}/${repository}`.toLowerCase();
}

export async function getProjectsPageData(username: string) {
  const [repositories, pinnedNames] = await Promise.all([
    getOptionalValue(
      () => getRepos(username),
      [],
      `repositories for ${username}`,
    ),
    getOptionalValue(
      () => getPinnedRepos(username),
      [],
      `pinned repositories for ${username}`,
    ),
  ]);
  const { heroes, sorted } = selectVisibleProjects(repositories, pinnedNames);

  return {
    heroes: heroes.map(toProjectCardData),
    sorted: sorted.map(toProjectCardData),
    isPortfolioOwner: isPortfolioOwnerUsername(username),
  };
}

export async function getOwnerProjectSecondaryData() {
  const [{ heroes, sorted }, vercelProjects] = await Promise.all([
    getProjectsPageData(PORTFOLIO_OWNER_USERNAME),
    getOptionalValue(
      () => getVercelProjects(),
      { projects: [] },
      'Vercel projects',
    ),
  ]);
  const projects = [...heroes, ...sorted].filter((project) =>
    isOwnedRepository(project, PORTFOLIO_OWNER_USERNAME),
  );
  const projectKeys = new Set(
    projects.map((project) => getRepositoryKey(project).toLowerCase()),
  );
  const vercelProjectsByRepository = new Map(
    vercelProjects.projects
      .map((project: any) => [getLinkedGitHubRepositoryKey(project), project])
      .filter(([key]) => key && projectKeys.has(key))
      .map(([key, project]: any) => [
        key,
        {
          framework: project.framework || null,
          nodeVersion: project.nodeVersion || null,
        },
      ]),
  );
  const projectsWithVercel = projects.map((project) => ({
    ...project,
    vercel: vercelProjectsByRepository.get(
      getRepositoryKey(project).toLowerCase(),
    ),
  }));
  const enrichedProjects = await enrichProjectsForCards(projectsWithVercel);

  return Object.fromEntries(
    enrichedProjects.map((project: any) => [
      getRepositoryKey(project),
      {
        ownerMetrics: {
          views: project.ownerMetrics.views,
          openAlertsBySeverity: project.ownerMetrics.openAlertsBySeverity,
          copilotPRCount: project.ownerMetrics.copilotPRCount,
          codexCount: project.ownerMetrics.codexCount,
          claudeCount: project.ownerMetrics.claudeCount,
        },
        vercel: project.vercel || null,
      },
    ]),
  );
}

export const getCopilotPRs = unstable_cache(
  async (username: string, reponame: string) => {
    const repo = `${username}/${reponame}`;
    console.log(`Fetching Copilot PRs for ${repo}`);

    try {
      const query = buildCopilotRepoSearchQuery(username, reponame);

      if (!query) {
        return 0;
      }

      const response = await fetchGitHubGraphQL(
        `
            query CopilotAuthoredMergedPRs($q: String!, $after: String) {
                search(type: ISSUE, query: $q, first: 50, after: $after) {
                    issueCount
                }
            }
        `,
        { q: query },
        {
          context: `Copilot PRs for ${username}/${reponame}`,
          fallback: { search: { issueCount: 0 } },
          next: { revalidate: HOURS_12 },
        },
      );
      return response.search?.issueCount || 0;
    } catch (error) {
      console.error(
        `Error getting Copilot PRs for ${username}/${reponame}:`,
        error,
      );
      return 0;
    }
  },
  ['getCopilotPRs'],
  { revalidate: HOURS_12 },
);

export const getCopilotPRsAccountWide = unstable_cache(
  async (username: string) => {
    console.log(`Fetching account-wide Copilot PRs for ${username}`);

    try {
      const query = buildCopilotAccountSearchQuery(username);

      if (!query) {
        return 0;
      }

      const response = await fetchGitHubGraphQL(
        `
            query CopilotAuthoredMergedPRsAccountWide($q: String!) {
                search(type: ISSUE, query: $q, first: 1) {
                    issueCount
                }
            }
        `,
        { q: query },
        {
          context: `account-wide Copilot PRs for ${username}`,
          fallback: { search: { issueCount: 0 } },
        },
      );

      return response.search?.issueCount || 0;
    } catch (error) {
      console.error(
        `Error getting account-wide Copilot PRs for ${username}:`,
        error,
      );
      return 0;
    }
  },
  ['getCopilotPRsAccountWide'],
  { revalidate: HOURS_12 },
);

export const getCodexCoauthoredCommitsAccountWide = unstable_cache(
  async (username: string) => {
    console.log(
      `Fetching account-wide Codex co-authored commits for ${username}`,
    );

    try {
      const query = buildCodexCoauthoredCommitSearchQuery(username);

      if (!query) {
        return 0;
      }

      const response = await fetchGitHubJson(
        `${GITHUB_API_URL}/search/commits?q=${encodeURIComponent(query)}&per_page=1`,
        {
          context: `account-wide Codex co-authored commits for ${username}`,
          fallback: { total_count: 0 },
          headers: { Accept: 'application/vnd.github.cloak-preview+json' },
          next: { revalidate: HOURS_12 },
        },
      );

      return typeof response?.total_count === 'number'
        ? response.total_count
        : 0;
    } catch (error) {
      console.error(
        `Error getting account-wide Codex co-authored commits for ${username}:`,
        error,
      );
      return 0;
    }
  },
  ['getCodexCoauthoredCommitsAccountWide'],
  { revalidate: HOURS_12 },
);

export const getClaudeCoauthoredCommitsAccountWide = unstable_cache(
  async (username: string) => {
    console.log(
      `Fetching account-wide Claude co-authored commits for ${username}`,
    );

    try {
      const query = buildClaudeCoauthoredCommitSearchQuery(username);

      if (!query) {
        return 0;
      }

      const response = await fetchGitHubJson(
        `${GITHUB_API_URL}/search/commits?q=${encodeURIComponent(query)}&per_page=1`,
        {
          context: `account-wide Claude co-authored commits for ${username}`,
          fallback: { total_count: 0 },
          headers: { Accept: 'application/vnd.github.cloak-preview+json' },
          next: { revalidate: HOURS_12 },
        },
      );

      return typeof response?.total_count === 'number'
        ? response.total_count
        : 0;
    } catch (error) {
      console.error(
        `Error getting account-wide Claude co-authored commits for ${username}:`,
        error,
      );
      return 0;
    }
  },
  ['getClaudeCoauthoredCommitsAccountWide'],
  { revalidate: HOURS_12 },
);

export const getCodexLabeledPRsAccountWide = unstable_cache(
  async (username: string) => {
    console.log(`Fetching account-wide codex-labeled PRs for ${username}`);

    try {
      const query = buildCodexLabeledAccountSearchQuery(username);

      if (!query) {
        return 0;
      }

      const response = await fetchGitHubGraphQL(
        `
            query CodexLabeledMergedPRsAccountWide($q: String!) {
                search(type: ISSUE, query: $q, first: 1) {
                    issueCount
                }
            }
        `,
        { q: query },
        {
          context: `account-wide codex-labeled PRs for ${username}`,
          fallback: { search: { issueCount: 0 } },
        },
      );

      return response.search?.issueCount || 0;
    } catch (error) {
      console.error(
        `Error getting account-wide codex-labeled PRs for ${username}:`,
        error,
      );
      return 0;
    }
  },
  ['getCodexLabeledPRsAccountWide'],
  { revalidate: HOURS_12 },
);

export const getClaudeLabeledPRsAccountWide = unstable_cache(
  async (username: string) => {
    console.log(`Fetching account-wide claude-labeled PRs for ${username}`);

    try {
      const query = buildClaudeLabeledAccountSearchQuery(username);

      if (!query) {
        return 0;
      }

      const response = await fetchGitHubGraphQL(
        `
            query ClaudeLabeledMergedPRsAccountWide($q: String!) {
                search(type: ISSUE, query: $q, first: 1) {
                    issueCount
                }
            }
        `,
        { q: query },
        {
          context: `account-wide claude-labeled PRs for ${username}`,
          fallback: { search: { issueCount: 0 } },
        },
      );

      return response.search?.issueCount || 0;
    } catch (error) {
      console.error(
        `Error getting account-wide claude-labeled PRs for ${username}:`,
        error,
      );
      return 0;
    }
  },
  ['getClaudeLabeledPRsAccountWide'],
  { revalidate: HOURS_12 },
);

export function detectFrameworks(packageJson: any) {
  if (!packageJson) return [];

  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  const frameworks: any[] = [];

  const frameworkMap: Record<string, any> = {
    next: {
      name: 'Next.js',
      type: 'nextjs',
      getLatestRelease: getNextjsLatestRelease,
    },
    astro: {
      name: 'Astro',
      type: 'astro',
      getLatestRelease: getAstroLatestRelease,
    },
    nuxt: {
      name: 'Nuxt',
      type: 'nuxt',
      getLatestRelease: getNuxtLatestRelease,
    },
    '@sveltejs/kit': {
      name: 'SvelteKit',
      type: 'sveltekit',
      getLatestRelease: getSvelteKitLatestRelease,
    },
    '@remix-run/react': {
      name: 'Remix',
      type: 'remix',
      getLatestRelease: getRemixLatestRelease,
    },
    gatsby: {
      name: 'Gatsby',
      type: 'gatsby',
      getLatestRelease: getGatsbyLatestRelease,
    },
  };

  for (const [dep, framework] of Object.entries(frameworkMap)) {
    if (dependencies[dep]) {
      const version = cleanDependencyVersion(dependencies[dep]);
      frameworks.push({
        ...framework,
        version,
        dependency: dep,
      });
    }
  }

  return frameworks;
}

function compareVersions(version1: string, version2: string): number {
  const parseVersion = (v: string) => {
    const cleaned = v.replace(/^v/, '').split('.');
    return cleaned.map((num) => parseInt(num, 10) || 0);
  };

  const v1 = parseVersion(version1);
  const v2 = parseVersion(version2);

  const maxLength = Math.max(v1.length, v2.length);

  for (let i = 0; i < maxLength; i++) {
    const num1 = v1[i] || 0;
    const num2 = v2[i] || 0;

    if (num1 < num2) return -1;
    if (num1 > num2) return 1;
  }

  return 0;
}

async function getFrameworkDetails(packageJson: any) {
  const detectedFrameworks = detectFrameworks(packageJson);

  const frameworksWithLatest = await Promise.all(
    detectedFrameworks.map(async (framework: any) => {
      // التعديل هنا
      const { getLatestRelease, ...frameworkInfo } = framework;

      try {
        const latestRelease = await getLatestRelease();
        const hasUpgrade =
          framework.version &&
          latestRelease.tagName &&
          compareVersions(framework.version, latestRelease.tagName) < 0;

        return {
          ...frameworkInfo,
          latestVersion: latestRelease.tagName,
          hasUpgrade,
          latestUpdatedAt: latestRelease.updatedAt,
        };
      } catch (error) {
        console.error(
          `Error getting latest release for ${framework.name}:`,
          error,
        );
        return {
          ...frameworkInfo,
          latestVersion: null,
          hasUpgrade: false,
        };
      }
    }),
  );

  return frameworksWithLatest;
}

export async function getRepositoryFrameworks(
  username: string,
  reponame: string,
) {
  const repository = await getRepositoryContentInfo(username, reponame);
  const packageJson = parseRepositoryPackageJson(
    repository,
    username,
    reponame,
  );
  return getFrameworkDetails(packageJson);
}
