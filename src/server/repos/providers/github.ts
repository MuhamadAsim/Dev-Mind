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

async function githubFetch(url: string, token?: string): Promise<any> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'DevMind-AI-Workspace',
  };

  const finalToken = token || process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (finalToken) {
    headers.Authorization = `token ${finalToken}`;
  }

  const res = await fetch(url, { headers, next: { revalidate: 60 } }); // Cache for 1 minute
  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`GitHub API Error (${res.status}): ${res.statusText}. ${errorBody}`);
  }

  return res.json();
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

    // Clean dirPath: make sure it doesn't start or end with slash
    const cleanPath = dirPath.replace(/^\/|\/$/g, '');
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}`;

    const items = (await githubFetch(url)) as GitHubContentItem[];
    const result: RepoFile[] = items.map((item) => ({
      name: item.type === 'dir' ? item.name + '/' : item.name,
      path: item.path,
      type: item.type === 'dir' ? 'folder' : 'file',
      size: item.size,
    }));

    // Sort folders first, then files
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

    // GitHub content is returned as base64 with newlines
    const contentBase64 = data.content.replace(/\n/g, '');
    return Buffer.from(contentBase64, 'base64').toString('utf-8');
  },

  /**
   * FIX: empty query now means "list every file in the repo" via the Git Trees API
   * (one recursive call), instead of falling through to `if (!query.trim()) return [];`
   * which is what made `listRepositoryFiles()` come back empty for every GitHub repo.
   * Non-empty query still uses GitHub code search as before.
   */
  async searchFiles(config: Record<string, string>, query: string): Promise<RepoFile[]> {
    const { owner, repo } = config;
    if (!owner || !repo) throw new Error('owner and repo are required');

    if (!query.trim()) {
      return listAllFilesViaTree(owner, repo, config.defaultBranch);
    }

    // Use GitHub code search API
    // Note: This API can rate limit quickly if unauthenticated, so we limit search results and catch errors.
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
};

/**
 * Lists every file in the repo in a single API call using the Git Trees API
 * (recursive=1), instead of walking directories one call at a time.
 * Falls back from the stored default branch to 'main' then 'master' if needed,
 * since `config.defaultBranch` may not be populated for repos connected before
 * this fix shipped.
 */
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
        .filter((item) => item.type === 'blob') // files only, skip sub-tree entries
        .slice(0, 500) // safety cap for very large repos
        .map((item) => ({
          name: item.path.split('/').pop() || item.path,
          path: item.path,
          type: 'file' as const,
        }));
    } catch (err) {
      // Try the next candidate branch (e.g. defaultBranch 404s, fall back to 'main')
      continue;
    }
  }

  console.warn(`[GitHubProvider] Could not list tree for ${owner}/${repo} on any of: ${branchesToTry.join(', ')}`);
  return [];
}