// ============================================================
// GitHub Repository Provider
// Interacts with GitHub REST API.
// ============================================================
import { RepositoryProvider, RepositoryMetadata, RepoFile } from '../types';

interface GitHubContentItem {
  name: string;
  path: string;
  type: 'dir' | 'file';
  size: number;
}

interface GitHubSearchItem {
  name: string;
  path: string;
}

interface GitHubTreeItem {
  path: string;
  type: 'blob' | 'tree' | 'commit';
}

/**
 * Shared GitHub API request helper.
 * Extended (from the original GET-only version) to also support PUT with a
 * JSON body, needed for writeFile's Contents API call.
 */
async function githubFetch(
  url: string,
  options: { method?: string; body?: Record<string, unknown> } = {}
): Promise<any> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'DevMind-AI-Workspace',
    'Content-Type': 'application/json',
  };

  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    // Only cache safe GET reads — never cache a write request.
    ...(options.method && options.method !== 'GET' ? {} : { next: { revalidate: 60 } }),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`GitHub API Error (${res.status}): ${res.statusText}. ${errorBody}`);
  }

  return res.json();
}

async function listAllFilesViaTree(
  owner: string,
  repo: string,
  defaultBranch?: string
): Promise<RepoFile[]> {
  const branchesToTry = [defaultBranch, 'main', 'master'].filter(
    (b, i, arr): b is string => !!b && arr.indexOf(b) === i
  );

  for (const branch of branchesToTry) {
    try {
      const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
      const treeResult = await githubFetch(treeUrl);
      const items = (treeResult.tree || []) as GitHubTreeItem[];

      return items
        .filter((item) => item.type === 'blob')
        .slice(0, 500)
        .map((item) => ({
          name: item.path.split('/').pop() || item.path,
          path: item.path,
          type: 'file' as const,
        }));
    } catch {
      continue;
    }
  }

  console.warn(`[GitHubProvider] Could not list tree for ${owner}/${repo} on any of: ${branchesToTry.join(', ')}`);
  return [];
}

export const GitHubProvider: RepositoryProvider = {
  async getMetadata(config: Record<string, string>): Promise<RepositoryMetadata> {
    const { owner, repo } = config;
    if (!owner || !repo) {
      throw new Error('owner and repo are required in configuration');
    }

    const url = `https://api.github.com/repos/${owner}/${repo}`;
    const data = await githubFetch(url);

    return {
      name: data.name,
      type: 'github',
      config,
      owner: data.owner?.login,
      description: data.description || '',
      defaultBranch: data.default_branch || 'main',
      primaryLanguage: data.language || 'Unknown',
      stars: data.stargazers_count || 0,
      lastUpdated: new Date(data.updated_at),
      currentBranch: data.default_branch || 'main',
      gitStatus: 'synced',
    };
  },

  async listDirectory(config: Record<string, string>, dirPath: string): Promise<RepoFile[]> {
    const { owner, repo } = config;
    if (!owner || !repo) throw new Error('owner and repo are required');

    const cleanPath = dirPath.replace(/^\/|\/$/g, '');
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}`;

    const items = (await githubFetch(url)) as GitHubContentItem[];
    const result: RepoFile[] = items.map((item) => ({
      name: item.type === 'dir' ? item.name + '/' : item.name,
      path: item.path,
      type: item.type === 'dir' ? 'folder' : 'file',
      size: item.size,
    }));

    return result.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  },

  async readFile(config: Record<string, string>, filePath: string): Promise<string> {
    const { owner, repo } = config;
    if (!owner || !repo) throw new Error('owner and repo are required');

    const cleanPath = filePath.replace(/^\/|\/$/g, '');
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}`;

    const data = await githubFetch(url);

    if (data.type !== 'file' || !data.content) {
      throw new Error(`Path is not a file or has no content: ${filePath}`);
    }

    const contentBase64 = data.content.replace(/\n/g, '');
    return Buffer.from(contentBase64, 'base64').toString('utf-8');
  },

  async searchFiles(config: Record<string, string>, query: string): Promise<RepoFile[]> {
    const { owner, repo } = config;
    if (!owner || !repo) throw new Error('owner and repo are required');

    if (!query.trim()) {
      return listAllFilesViaTree(owner, repo, config.defaultBranch);
    }

    try {
      const url = `https://api.github.com/search/code?q=${encodeURIComponent(query)}+repo:${owner}/${repo}`;
      const searchResult = await githubFetch(url);

      const items = (searchResult.items || []) as GitHubSearchItem[];
      return items.slice(0, 100).map((item) => ({
        name: item.name,
        path: item.path,
        type: 'file',
      }));
    } catch (err) {
      console.warn('[GitHubProvider] Search failed, fallback returning empty results:', err);
      return [];
    }
  },

  // ── NEW: write support ────────────────────────────────────

  /**
   * Writes (creates or updates) a file via the GitHub Contents API.
   * GitHub requires the file's current `sha` when UPDATING an existing
   * file (omitting it on an update fails with a 409 conflict) — so we
   * first try to fetch the existing file to get its sha; a 404 there
   * just means we're creating a brand-new file, which is fine.
   */
  async writeFile(
    config: Record<string, string>,
    filePath: string,
    content: string,
    commitMessage?: string
  ): Promise<void> {
    const { owner, repo } = config;
    if (!owner || !repo) throw new Error('owner and repo are required');

    const branch = config.defaultBranch || 'main';
    const cleanPath = filePath.replace(/^\/|\/$/g, '');
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}`;

    let sha: string | undefined;
    try {
      const existing = await githubFetch(`${url}?ref=${branch}`);
      sha = existing.sha;
    } catch {
      // File doesn't exist yet on this branch — that's fine, we're creating it.
    }

    const body: Record<string, unknown> = {
      message: commitMessage?.trim() || `Update ${cleanPath} via DevMind AI`,
      content: Buffer.from(content, 'utf-8').toString('base64'),
      branch,
    };
    if (sha) body.sha = sha; // required by GitHub when overwriting an existing file

    await githubFetch(url, { method: 'PUT', body });
  },

  /**
   * Git has no concept of an empty directory — a directory only "exists"
   * if it contains at least one tracked file. So "create a directory" on
   * GitHub means committing a placeholder file inside it. `.gitkeep` is
   * the common convention; it has no special meaning to Git itself.
   */
  async createDirectory(config: Record<string, string>, dirPath: string): Promise<void> {
    const cleanPath = dirPath.replace(/^\/|\/$/g, '');
    const gitkeepPath = `${cleanPath}/.gitkeep`;
    await GitHubProvider.writeFile(config, gitkeepPath, '', `Create directory ${cleanPath} via DevMind AI`);
  },
};