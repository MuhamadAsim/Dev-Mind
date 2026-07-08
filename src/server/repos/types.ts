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

  /** Read multiple files in bulk (optional) */
  readFilesBulk?(
    config: Record<string, string>,
    filePaths: string[]
  ): Promise<Map<string, string>>;

  /** Search for files in the repository matching the query */
  searchFiles(config: Record<string, string>, query: string): Promise<RepoFile[]>;

  /**
   * Write content to a file — creates it if it doesn't exist, overwrites if it does.
   * Only ever called from server code AFTER the user has explicitly confirmed —
   * never called directly by an LLM tool. See ai/tools.ts proposeFileWrite.
   * @param commitMessage GitHub only — ignored by LocalProvider.
   */
  writeFile(
    config: Record<string, string>,
    filePath: string,
    content: string,
    commitMessage?: string
  ): Promise<void>;

  /**
   * Create a directory (and any missing parent directories).
   * NOTE: Git has no concept of an empty directory — GitHubProvider
   * implements this by committing a placeholder `.gitkeep` file inside it.
   */
  createDirectory(config: Record<string, string>, dirPath: string): Promise<void>;
}