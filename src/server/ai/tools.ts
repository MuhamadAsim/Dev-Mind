import { z } from 'zod';
import { tool } from 'ai';
import {
  readFile,
  listDirectory,
  getRepositoryMetadata,
  getCurrentBranch,
  getGitStatus,
  listRepositoryFiles,
  searchFiles,
  listAllConnectedRepos,
  getRepoById,
  disconnectRepoById,
} from '../repos/repositoryTools';
import type { ChatSession } from './types';

const NO_REPO_ERROR = {
  error:
    'No repository is currently active. Call listConnectedRepos to see what\'s connected, then selectRepo to activate one before reading files.',
};

/** Case-insensitive substring match against connected repo names.
 *  Known limitation: if two repo names both match, this returns the
 *  first one found — good enough for now, but if you hit this in
 *  practice, upgrade it to return all matches and let the LLM ask
 *  the user to disambiguate instead of silently picking one. */
async function findRepoByName(nameQuery: string) {
  const repos = await listAllConnectedRepos();
  const lower = nameQuery.trim().toLowerCase();
  return repos.find((r) => r.name.toLowerCase().includes(lower)) ?? null;
}

/**
 * Builds the full tool set for one chat turn.
 * `session` is shared (by reference) across every tool call in this turn
 * AND is read again by route.ts after the stream ends — that's how a
 * repo picked mid-chat gets pushed back to the client's Zustand store.
 */
export function createRepositoryTools(session: ChatSession) {
  return {
    // ── Repo management — always available, no active repo required ──

    listConnectedRepos: tool({
      description:
        'List every repository the user has connected (GitHub and local). Call this whenever the user asks about "the repo" / "my project" but no repository is currently active, so you can show them their options before doing anything else.',
      inputSchema: z.object({}),
      execute: async () => {
        const repos = await listAllConnectedRepos();
        return {
          repos: repos.map((r) => ({ id: r.id, name: r.name, type: r.type })),
          activeRepoId: session.activeRepoId,
        };
      },
    }),

    selectRepo: tool({
      description:
        'Activate a connected repository by name so file/read/search tools operate on it. If you don\'t know the exact name, call listConnectedRepos first.',
      inputSchema: z.object({
        repoName: z
          .string()
          .describe('Name (or partial name) of the repo to activate, e.g. "devmind" or "owner/repo".'),
      }),
      execute: async ({ repoName }) => {
        const repo = await findRepoByName(repoName);
        if (!repo) {
          return {
            error: `No connected repository matches "${repoName}". Call listConnectedRepos to see available options.`,
          };
        }
        session.activeRepoId = repo.id; // ← the actual mid-turn switch
        return { success: true, activeRepoId: repo.id, name: repo.name };
      },
    }),

    disconnectRepo: tool({
      description:
        'Disconnect a repository. Pass "current" to disconnect whichever repo is active right now, or a repo name to disconnect a specific one.',
      inputSchema: z.object({
        repoName: z.string().describe('Repo name to disconnect, or the literal word "current".'),
      }),
      execute: async ({ repoName }) => {
        const isCurrent = repoName.trim().toLowerCase() === 'current';
        const targetId = isCurrent ? session.activeRepoId : (await findRepoByName(repoName))?.id ?? null;

        if (!targetId) {
          return { error: `Could not find a connected repository matching "${repoName}".` };
        }

        const repo = await getRepoById(targetId);
        await disconnectRepoById(targetId);

        if (session.activeRepoId === targetId) {
          session.activeRepoId = null; // clear it so route.ts pushes null to the client too
        }

        return { success: true, disconnectedName: repo?.name ?? repoName };
      },
    }),

    // ── Repo content — require an active repo ──

    readFile: tool({
      description: 'Read the text content of a file from the active repository.',
      inputSchema: z.object({
        filePath: z.string().describe('Path relative to the repository root.'),
      }),
      execute: async ({ filePath }) => {
        if (!session.activeRepoId) return NO_REPO_ERROR;
        try {
          return { content: await readFile(session.activeRepoId, filePath) };
        } catch (error: any) {
          return { error: error.message || String(error) };
        }
      },
    }),

    listDirectory: tool({
      description: 'List files and subdirectories in a directory of the active repository.',
      inputSchema: z.object({
        dirPath: z.string().describe('Path relative to repo root. Use "" for root.'),
      }),
      execute: async ({ dirPath }) => {
        if (!session.activeRepoId) return NO_REPO_ERROR;
        try {
          return { files: await listDirectory(session.activeRepoId, dirPath) };
        } catch (error: any) {
          return { error: error.message || String(error) };
        }
      },
    }),

    searchFiles: tool({
      description: 'Search for files in the active repository by name or path.',
      inputSchema: z.object({
        query: z.string().describe('Search query, e.g. "README" or "ts".'),
      }),
      execute: async ({ query }) => {
        if (!session.activeRepoId) return NO_REPO_ERROR;
        try {
          return { files: await searchFiles(session.activeRepoId, query) };
        } catch (error: any) {
          return { error: error.message || String(error) };
        }
      },
    }),

    getRepositoryMetadata: tool({
      description: 'Get metadata of the active repository (description, stars, branch, language).',
      inputSchema: z.object({}),
      execute: async () => {
        if (!session.activeRepoId) return NO_REPO_ERROR;
        try {
          return { metadata: await getRepositoryMetadata(session.activeRepoId) };
        } catch (error: any) {
          return { error: error.message || String(error) };
        }
      },
    }),

    getCurrentBranch: tool({
      description: 'Get the active git branch name of the active repository.',
      inputSchema: z.object({}),
      execute: async () => {
        if (!session.activeRepoId) return NO_REPO_ERROR;
        try {
          return { branch: await getCurrentBranch(session.activeRepoId) };
        } catch (error: any) {
          return { error: error.message || String(error) };
        }
      },
    }),

    getGitStatus: tool({
      description: 'Get the git status (clean/modified/synced) of the active repository.',
      inputSchema: z.object({}),
      execute: async () => {
        if (!session.activeRepoId) return NO_REPO_ERROR;
        try {
          return { status: await getGitStatus(session.activeRepoId) };
        } catch (error: any) {
          return { error: error.message || String(error) };
        }
      },
    }),

    listRepositoryFiles: tool({
      description: 'List all files across the entire active repository, recursively.',
      inputSchema: z.object({}),
      execute: async () => {
        if (!session.activeRepoId) return NO_REPO_ERROR;
        try {
          return { files: await listRepositoryFiles(session.activeRepoId) };
        } catch (error: any) {
          return { error: error.message || String(error) };
        }
      },
    }),
  };
}