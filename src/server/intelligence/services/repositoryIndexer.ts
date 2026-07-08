import { listRepositoryFiles } from '../../repos/repositoryService';
import { IndexedFile } from '../types';

export async function buildFileIndex(repoId: string): Promise<Map<string, IndexedFile>> {
  const rawFiles = await listRepositoryFiles(repoId);
  const filesMap = new Map<string, IndexedFile>();
  const skipDirs = ['node_modules', '.git', '.next', 'dist', 'build', 'coverage'];

  for (const f of rawFiles) {
    if (f.type !== 'file') continue;

    const pathParts = f.path.split('/');
    const shouldSkip = pathParts.some((part) => skipDirs.includes(part));
    if (shouldSkip) continue;

    const ext = f.path.split('.').pop() || '';
    const language = detectLanguage(ext);

    filesMap.set(f.path, {
      path: f.path,
      name: f.name,
      extension: ext,
      language,
      size: f.size ?? 0,
      lastModified: new Date(),
    });
  }

  return filesMap;
}

function detectLanguage(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'ts':
    case 'tsx':
      return 'TypeScript';
    case 'js':
    case 'jsx':
      return 'JavaScript';
    case 'json':
      return 'JSON';
    case 'md':
      return 'Markdown';
    case 'css':
      return 'CSS';
    case 'html':
      return 'HTML';
    default:
      return 'Text';
  }
}
