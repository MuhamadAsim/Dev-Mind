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
} from '../repos/repositoryTools';
import type { ChatSession } from './types';

const NO_REPO_ERROR = {
  error:
    'No repository is currently active. Call listConnectedRepos to see what\'s connected, then selectRepo to activate one before reading files.',
};

async function findRepoByName(nameQuery: string) {
  const repos = await listAllConnectedRepos();
  const lower = nameQuery.trim().toLowerCase();
  return repos.find((r) => r.name.toLowerCase().includes(lower)) ?? null;
}

export function createRepositoryTools(session: ChatSession) {
  return {
    // ── Repo management ──

    listConnectedRepos: tool({
      description:
        'List every repository the user has connected (GitHub and local). Call this whenever the user asks about "the repo" / "my project" but no repository is currently active.',
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
        'Activate a connected repository by name so file/read/search/write tools operate on it. If you don\'t know the exact name, call listConnectedRepos first.',
      inputSchema: z.object({
        repoName: z.string().describe('Name (or partial name) of the repo to activate.'),
      }),
      execute: async ({ repoName }) => {
        const repo = await findRepoByName(repoName);
        if (!repo) {
          return { error: `No connected repository matches "${repoName}". Call listConnectedRepos to see available options.` };
        }
        session.activeRepoId = repo.id;
        return { success: true, activeRepoId: repo.id, name: repo.name };
      },
    }),

    // NOTE: This is a SESSION-ONLY deactivation. It clears which repo the
    // AI is currently pointed at for this conversation — it does NOT
    // delete the repository connection. The repo stays in the user's
    // connected list and can be reselected later via selectRepo, or from
    // the Repository panel in the UI. Permanent removal (deleting the DB
    // record) is only ever done through the trash-icon button in
    // RepositoryPanel.tsx — never from chat.
    disconnectRepo: tool({
      description:
        'Deactivate the currently active repository for this conversation, so file tools no longer target it. This does NOT delete or remove the repository connection — it stays available and can be reselected later with selectRepo, or from the Repository panel in the app. Only use this when the user asks to "stop working on" / "unset" / "disconnect from" the current repo in this chat.',
      inputSchema: z.object({}),
      execute: async () => {
        if (!session.activeRepoId) {
          return { error: 'No repository is currently active in this conversation.' };
        }

        const repo = await getRepoById(session.activeRepoId);
        const deactivatedName = repo?.name ?? 'the active repository';
        session.activeRepoId = null;

        return {
          success: true,
          deactivatedName,
          note: 'The repository connection itself was NOT removed — it is still available and can be reselected.',
        };
      },
    }),

    // ── Repo content — read ──

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

    // ── Repo content — write (PROPOSE ONLY — never writes directly) ──

    proposeFileWrite: tool({
      description:
        'Propose writing content to a file (creating or overwriting it) in the active repository. This does NOT write anything — it only stages a proposal. You MUST show the user the exact file path and content, and explicitly ask them to reply "yes" to confirm or "no" to cancel, before this takes effect. Never tell the user the file has been written — it has not, until they confirm.',
      inputSchema: z.object({
        filePath: z.string().describe('Path relative to repo root, e.g. "src/utils/helpers.ts".'),
        content: z.string().describe('Full file content to write.'),
        commitMessage: z
          .string()
          .optional()
          .describe('Git commit message. Only used for GitHub repos; ignored for local repos.'),
      }),
      execute: async ({ filePath, content, commitMessage }) => {
        if (!session.activeRepoId) return NO_REPO_ERROR;
        const repo = await getRepoById(session.activeRepoId);
        if (!repo) return { error: 'Active repository no longer exists.' };

        session.pendingWrite = {
          action: 'writeFile',
          repoId: session.activeRepoId,
          repoName: repo.name,
          path: filePath,
          content,
          commitMessage,
          proposedAt: new Date().toISOString(),
        };

        return {
          proposed: true,
          filePath,
          repoName: repo.name,
          preview: content.length > 500 ? content.slice(0, 500) + '\n…(truncated)' : content,
          instructions:
            'Show this file path and content to the user now, and ask them to reply "yes" to confirm or "no" to cancel. Do not assume approval and do not say it has been written.',
        };
      },
    }),

    proposeCreateDirectory: tool({
      description:
        'Propose creating a new directory in the active repository. This does NOT create anything — the user must confirm with "yes" in their next message.',
      inputSchema: z.object({
        dirPath: z.string().describe('Directory path relative to repo root, e.g. "src/components/widgets".'),
      }),
      execute: async ({ dirPath }) => {
        if (!session.activeRepoId) return NO_REPO_ERROR;
        const repo = await getRepoById(session.activeRepoId);
        if (!repo) return { error: 'Active repository no longer exists.' };

        session.pendingWrite = {
          action: 'createDirectory',
          repoId: session.activeRepoId,
          repoName: repo.name,
          path: dirPath,
          proposedAt: new Date().toISOString(),
        };

        return {
          proposed: true,
          dirPath,
          repoName: repo.name,
          instructions: 'Ask the user to confirm ("yes") or cancel ("no") before this directory is actually created.',
        };
      },
    }),
  };
}