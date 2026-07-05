// ============================================================
// Repository Types & Provider Interface
// Decouples filesystem and GitHub operations from core logic.
// ============================================================

export interface RepoFile {
  name: string;
  /** Relative path from repository root */
  path: string;
  type: 'file' | 'folder';
  size?: number;
  /** Estimated number of child items for directories */
  childrenCount?: number;
}

export interface RepositoryMetadata {
  name: string;
  type: 'github' | 'local';
  config: Record<string, string>;
  owner?: string;
  description?: string;
  defaultBranch?: string;
  primaryLanguage?: string;
  stars?: number;
  lastUpdated?: Date;
  currentBranch?: string;
  gitStatus?: string;
  fileCount?: number;
}

/**
 * RepositoryProvider interface.
 * Implemented by LocalProvider and GitHubProvider.
 */
export interface RepositoryProvider {
  /** Fetch repository metadata (stars, description, branches, language) */
  getMetadata(config: Record<string, string>): Promise<RepositoryMetadata>;

  /** List contents of a subdirectory in the repository */
  listDirectory(config: Record<string, string>, dirPath: string): Promise<RepoFile[]>;

  /** Read file content */
  readFile(config: Record<string, string>, filePath: string): Promise<string>;

  /** Search for files in the repository matching the query */
  searchFiles(config: Record<string, string>, query: string): Promise<RepoFile[]>;
}
