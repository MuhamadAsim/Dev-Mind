import { Project } from 'ts-morph';

declare global {
  // eslint-disable-next-line no-var
  var __repoAstStore: Map<string, Project> | undefined;
}

const astStore = global.__repoAstStore ?? new Map<string, Project>();
global.__repoAstStore = astStore;

export function getProject(repoId: string): Project | undefined {
  return astStore.get(repoId);
}

export function setProject(repoId: string, project: Project): void {
  astStore.set(repoId, project);
}

export function clearProject(repoId: string): void {
  astStore.delete(repoId);
}
