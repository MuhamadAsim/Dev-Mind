import { RepositoryKnowledge } from '../types';
import { buildRepositoryKnowledge } from '../services/repositoryKnowledgeBuilder';
import { clearProject } from './repositoryAstStore';

declare global {
  // eslint-disable-next-line no-var
  var __repoKnowledgeStore: Map<string, Promise<RepositoryKnowledge>> | undefined;
}

const store = global.__repoKnowledgeStore ?? new Map<string, Promise<RepositoryKnowledge>>();
global.__repoKnowledgeStore = store;

export async function getOrBuildRepositoryKnowledge(repoId: string): Promise<RepositoryKnowledge> {
  const existing = store.get(repoId);
  if (existing) return existing;

  const buildPromise = buildRepositoryKnowledge(repoId);
  store.set(repoId, buildPromise);

  // Clear from cache if build fails to allow retry
  buildPromise.catch(() => {
    store.delete(repoId);
    clearProject(repoId);
  });

  return buildPromise;
}

export function invalidateRepositoryKnowledge(repoId: string): void {
  store.delete(repoId);
  clearProject(repoId);
}
