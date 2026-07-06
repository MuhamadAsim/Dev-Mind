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
} from '../repos/repositoryTools';

/**
 * Creates Vercel AI SDK compatible tool definitions pre-bound to the active repository ID.
 * The activeRepoId is automatically injected, so the LLM does not need to know or specify it.
 */
export function createRepositoryTools(activeRepoId: string) {
  return {
    readFile: tool({
      description: 'Read the text content of a file from the repository.',
      inputSchema: z.object({
        filePath: z.string().describe('The path to the file relative to the repository root.'),
      }),
      execute: async ({ filePath }) => {
        try {
          const content = await readFile(activeRepoId, filePath);
          return { content };
        } catch (error: any) {
          return { error: error.message || String(error) };
        }
      },
    }),

    listDirectory: tool({
      description: 'List the files and subdirectories in a directory path.',
      inputSchema: z.object({
        dirPath: z.string().describe('The path to the directory relative to the repository root. Use empty string "" for the root directory.'),
      }),
      execute: async ({ dirPath }) => {
        try {
          const files = await listDirectory(activeRepoId, dirPath);
          return { files };
        } catch (error: any) {
          return { error: error.message || String(error) };
        }
      },
    }),

    searchFiles: tool({
      description: 'Search for files in the repository by name or path matching a query.',
      inputSchema: z.object({
        query: z.string().describe('The search query to match against file paths (e.g. "README" or "ts").'),
      }),
      execute: async ({ query }) => {
        try {
          const files = await searchFiles(activeRepoId, query);
          return { files };
        } catch (error: any) {
          return { error: error.message || String(error) };
        }
      },
    }),

    getRepositoryMetadata: tool({
      description: 'Get full metadata details of the connected repository, including type, description, stars, default branch, and languages.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const metadata = await getRepositoryMetadata(activeRepoId);
          return { metadata };
        } catch (error: any) {
          return { error: error.message || String(error) };
        }
      },
    }),

    getCurrentBranch: tool({
      description: 'Get the active git branch name of the repository.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const branch = await getCurrentBranch(activeRepoId);
          return { branch };
        } catch (error: any) {
          return { error: error.message || String(error) };
        }
      },
    }),

    getGitStatus: tool({
      description: 'Get the current status of the git repository (e.g., clean, modified, out of sync).',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const status = await getGitStatus(activeRepoId);
          return { status };
        } catch (error: any) {
          return { error: error.message || String(error) };
        }
      },
    }),

    listRepositoryFiles: tool({
      description: 'List all files across the entire repository recursively.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const files = await listRepositoryFiles(activeRepoId);
          return { files };
        } catch (error: any) {
          return { error: error.message || String(error) };
        }
      },
    }),
  };
}
