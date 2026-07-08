// ============================================================
// Repository Tools
// Reusable backend tool functions. Future AI agents / tool callers
// will import and run these directly. Exposes a clean API boundary
// that routes requests to RepositoryService.
// ============================================================
import {
  getRepositoryDetails,
  listRepositoryDirectory,
  readRepositoryFile,
  searchRepositoryFiles,
  getRepository,
  listConnectedRepositories,
  disconnectRepository,
  listRepositoryFiles as listRepositoryFilesService,
} from './repositoryService';
import { RepoFile, RepositoryMetadata } from './types';
import { IConnectedRepository } from '../db/models/ConnectedRepository';

/** Read file content from a connected repository */
export async function readFile(repoId: string, filePath: string): Promise<string> {
  return readRepositoryFile(repoId, filePath);
}

/** List directory contents from a connected repository */
export async function listDirectory(repoId: string, dirPath: string): Promise<RepoFile[]> {
  return listRepositoryDirectory(repoId, dirPath);
}

/** Get full metadata details of a connected repository */
export async function getRepositoryMetadata(repoId: string): Promise<RepositoryMetadata> {
  return getRepositoryDetails(repoId);
}

/** Get the current branch of a connected repository */
export async function getCurrentBranch(repoId: string): Promise<string> {
  const repo = await getRepository(repoId);
  if (!repo) throw new Error(`Repository not found: ${repoId}`);
  const details = await getRepositoryDetails(repoId);
  return details.currentBranch || repo.defaultBranch || 'main';
}

/** Get the Git status (e.g. modified, clean, synced) of a connected repository */
export async function getGitStatus(repoId: string): Promise<string> {
  const repo = await getRepository(repoId);
  if (!repo) throw new Error(`Repository not found: ${repoId}`);
  const details = await getRepositoryDetails(repoId);
  return details.gitStatus || 'clean';
}

/** Lists files in the repository (e.g. searching with empty/wildcard queries) */
export async function listRepositoryFiles(repoId: string): Promise<RepoFile[]> {
  return listRepositoryFilesService(repoId);
}

/** Searches for files matching the given query inside the repository */
export async function searchFiles(repoId: string, query: string): Promise<RepoFile[]> {
  return searchRepositoryFiles(repoId, query);
}

// ── Repo-management wrappers (list / resolve / disconnect) ──────

/** List every connected repository (github + local) */
export async function listAllConnectedRepos(): Promise<IConnectedRepository[]> {
  return listConnectedRepositories();
}

/** Fetch a single connected repo's DB record by id */
export async function getRepoById(repoId: string): Promise<IConnectedRepository | null> {
  return getRepository(repoId);
}

/** Disconnect a repository by id */
export async function disconnectRepoById(repoId: string): Promise<void> {
  return disconnectRepository(repoId);
}