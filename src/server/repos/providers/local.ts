// ============================================================
// Local Repository Provider
// Interacts with local filesystem and git CLI.
// ============================================================
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { RepositoryProvider, RepositoryMetadata, RepoFile } from '../types';

function runGitCommand(cmd: string, cwd: string): Promise<string> {
  return new Promise((resolve) => {
    exec(cmd, { cwd }, (error, stdout) => {
      if (error) {
        resolve('');
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

export const LocalProvider: RepositoryProvider = {
  async getMetadata(config: Record<string, string>): Promise<RepositoryMetadata> {
    const localPath = config.localPath;
    if (!localPath) {
      throw new Error('localPath is required in configuration');
    }

    if (!fs.existsSync(localPath)) {
      throw new Error(`Path does not exist: ${localPath}`);
    }

    const stat = fs.statSync(localPath);
    if (!stat.isDirectory()) {
      throw new Error(`Path is not a directory: ${localPath}`);
    }

    // Detect if Git repo
    const isGit = fs.existsSync(path.join(localPath, '.git'));
    let currentBranch = 'none';
    let gitStatus = 'clean';

    if (isGit) {
      currentBranch = await runGitCommand('git branch --show-current', localPath) || 'main';
      const statusRaw = await runGitCommand('git status --porcelain', localPath);
      gitStatus = statusRaw ? 'modified' : 'clean';
    }

    const name = path.basename(localPath) || 'local-repo';

    return {
      name,
      type: 'local',
      config,
      description: `Local directory at ${localPath}`,
      defaultBranch: currentBranch,
      primaryLanguage: 'TypeScript', // Inferred/default
      lastUpdated: stat.mtime,
      currentBranch,
      gitStatus,
    };
  },

  async listDirectory(config: Record<string, string>, dirPath: string): Promise<RepoFile[]> {
    const localPath = config.localPath;
    if (!localPath) throw new Error('localPath is required');

    const targetDir = path.join(localPath, dirPath);
    if (!fs.existsSync(targetDir)) {
      throw new Error(`Directory does not exist: ${targetDir}`);
    }

    const files = fs.readdirSync(targetDir);
    const result: RepoFile[] = [];

    for (const file of files) {
      // Ignore version control & build artifacts for safety and performance
      if (['.git', 'node_modules', '.next', 'dist', 'build', '.DS_Store'].includes(file)) {
        continue;
      }

      const fullPath = path.join(targetDir, file);
      const relativePath = path.relative(localPath, fullPath).replace(/\\/g, '/');
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        result.push({
          name: file + '/',
          path: relativePath,
          type: 'folder',
        });
      } else {
        result.push({
          name: file,
          path: relativePath,
          type: 'file',
          size: stat.size,
        });
      }
    }

    // Sort folders first, then files
    return result.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  },

  async readFile(config: Record<string, string>, filePath: string): Promise<string> {
    const localPath = config.localPath;
    if (!localPath) throw new Error('localPath is required');

    const targetFile = path.join(localPath, filePath);
    // Path traversal guard
    if (!targetFile.startsWith(path.resolve(localPath))) {
      throw new Error('Path traversal detected');
    }

    if (!fs.existsSync(targetFile)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    return fs.readFileSync(targetFile, 'utf-8');
  },

  async searchFiles(config: Record<string, string>, query: string): Promise<RepoFile[]> {
    const localPath = config.localPath;
    if (!localPath) throw new Error('localPath is required');

    const matches: RepoFile[] = [];
    const lowerQuery = query.toLowerCase();

    function recurse(dir: string) {
      if (matches.length >= 100) return; // Limit search results

      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (['.git', 'node_modules', '.next', 'dist', 'build', '.DS_Store'].includes(file)) {
          continue;
        }

        const fullPath = path.join(dir, file);
        const relativePath = path.relative(localPath, fullPath).replace(/\\/g, '/');
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          recurse(fullPath);
        } else if (file.toLowerCase().includes(lowerQuery) || relativePath.toLowerCase().includes(lowerQuery)) {
          matches.push({
            name: file,
            path: relativePath,
            type: 'file',
            size: stat.size,
          });
        }
      }
    }

    recurse(localPath);
    return matches;
  },
};
