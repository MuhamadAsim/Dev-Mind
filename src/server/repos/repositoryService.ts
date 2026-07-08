// ============================================================
// Repository Service
// central manager for repository connections and queries.
// Resolves the provider ('local' | 'github') dynamically.
// ============================================================
import { connectDB } from '../db/mongoose';
import { ConnectedRepositoryModel, IConnectedRepository } from '../db/models/ConnectedRepository';
import { RepositoryProvider, RepositoryMetadata, RepoFile } from './types';
import { LocalProvider } from './providers/local';
import { GitHubProvider } from './providers/github';
import path from 'path';

function getProvider(type: 'local' | 'github'): RepositoryProvider {
  if (type === 'local') return LocalProvider;
  if (type === 'github') return GitHubProvider;
  throw new Error(`Unsupported repository type: ${type}`);
}

export async function listConnectedRepositories(): Promise<IConnectedRepository[]> {
  await connectDB();
  return ConnectedRepositoryModel.find({}).sort({ createdAt: -1 });
}

export async function getRepository(id: string): Promise<IConnectedRepository | null> {
  await connectDB();
  return ConnectedRepositoryModel.findById(id);
}

export async function connectRepository(
  type: 'local' | 'github',
  configInput: Record<string, string>
): Promise<IConnectedRepository> {
  await connectDB();

  let config: Record<string, string> = {};
  let resolvedName = '';

  if (type === 'local') {
    const rawPath = configInput.localPath;
    if (!rawPath) throw new Error('localPath is required');
    const localPath = path.resolve(rawPath);
    config = { localPath };
    resolvedName = path.basename(localPath) || 'local-repo';
  } else if (type === 'github') {
    let { owner, repo } = configInput;
    if (!owner || !repo) {
      const url = configInput.url;
      if (url) {
        const match = url.match(/github\.com[/:]([^/]+)\/([^/.\s]+)(?:\.git)?/);
        if (match) {
          owner = match[1];
          repo = match[2];
        }
      }
    }
    if (!owner || !repo) {
      throw new Error('owner and repo (or valid GitHub URL) are required');
    }
    config = { owner, repo };
    resolvedName = `${owner}/${repo}`;
  }

  const existing = await ConnectedRepositoryModel.findOne({
    type,
    ...(type === 'local'
      ? { 'config.localPath': config.localPath }
      : { 'config.owner': config.owner, 'config.repo': config.repo }),
  });

  if (existing) {
    return existing;
  }

  const provider = getProvider(type);
  const metadata = await provider.getMetadata(config);

  if (type === 'github' && metadata.defaultBranch) {
    config = { ...config, defaultBranch: metadata.defaultBranch };
  }

  const newRepo = new ConnectedRepositoryModel({
    name: metadata.name || resolvedName,
    type,
    config,
    owner: metadata.owner,
    description: metadata.description,
    defaultBranch: metadata.defaultBranch,
    primaryLanguage: metadata.primaryLanguage,
    stars: metadata.stars,
    lastUpdated: metadata.lastUpdated,
  });

  await newRepo.save();
  return newRepo;
}

export async function disconnectRepository(id: string): Promise<void> {
  await connectDB();
  await ConnectedRepositoryModel.findByIdAndDelete(id);
}

export async function getRepositoryDetails(id: string): Promise<RepositoryMetadata> {
  const repo = await getRepository(id);
  if (!repo) throw new Error(`Repository not found: ${id}`);

  const provider = getProvider(repo.type);
  return provider.getMetadata(repo.config);
}

export async function listRepositoryDirectory(id: string, dirPath: string): Promise<RepoFile[]> {
  const repo = await getRepository(id);
  if (!repo) throw new Error(`Repository not found: ${id}`);

  const provider = getProvider(repo.type);
  return provider.listDirectory(repo.config, dirPath);
}

export async function readRepositoryFile(id: string, filePath: string): Promise<string> {
  const repo = await getRepository(id);
  if (!repo) throw new Error(`Repository not found: ${id}`);

  const provider = getProvider(repo.type);
  return provider.readFile(repo.config, filePath);
}

export async function searchRepositoryFiles(id: string, query: string): Promise<RepoFile[]> {
  const repo = await getRepository(id);
  if (!repo) throw new Error(`Repository not found: ${id}`);

  const provider = getProvider(repo.type);
  return provider.searchFiles(repo.config, query);
}

/** Lists files in the repository recursively */
export async function listRepositoryFiles(id: string): Promise<RepoFile[]> {
  return searchRepositoryFiles(id, '');
}

/** Read multiple files in bulk. Returns { supported: false } if the provider does not support bulk reads. */
export async function readRepositoryFilesBulk(
  id: string,
  filePaths: string[]
): Promise<{ supported: boolean; contents?: Map<string, string> }> {
  const repo = await getRepository(id);
  if (!repo) throw new Error(`Repository not found: ${id}`);

  const provider = getProvider(repo.type);
  if (!provider.readFilesBulk) {
    return { supported: false };
  }

  const contents = await provider.readFilesBulk(repo.config, filePaths);
  return { supported: true, contents };
}


// ── NEW: write support — dispatch only, same pattern as reads above ──

/** Write (create/overwrite) a file. Only ever call this AFTER user confirmation. */
export async function writeRepositoryFile(
  id: string,
  filePath: string,
  content: string,
  commitMessage?: string
): Promise<void> {
  const repo = await getRepository(id);
  if (!repo) throw new Error(`Repository not found: ${id}`);

  const provider = getProvider(repo.type);
  return provider.writeFile(repo.config, filePath, content, commitMessage);
}

/** Create a directory. Only ever call this AFTER user confirmation. */
export async function createRepositoryDirectory(id: string, dirPath: string): Promise<void> {
  const repo = await getRepository(id);
  if (!repo) throw new Error(`Repository not found: ${id}`);

  const provider = getProvider(repo.type);
  return provider.createDirectory(repo.config, dirPath);
}