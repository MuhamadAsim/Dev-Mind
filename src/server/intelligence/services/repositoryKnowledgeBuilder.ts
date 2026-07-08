import { buildFileIndex } from './repositoryIndexer';
import { buildTypescriptIndex } from './typescriptIndexer';
import { RepositoryKnowledge } from '../types';

export async function buildRepositoryKnowledge(repoId: string): Promise<RepositoryKnowledge> {
  const files = await buildFileIndex(repoId);
  const { symbols, dependencies } = await buildTypescriptIndex(repoId, files);

  return {
    repoId,
    files,
    symbols,
    dependencies,
    indexedAt: new Date(),
  };
}
