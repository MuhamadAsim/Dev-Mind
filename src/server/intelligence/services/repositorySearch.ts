import { getOrBuildRepositoryKnowledge } from '../store/repositoryIndexStore';
import { IndexedFile, IndexedSymbol } from '../types';

export async function findByPath(repoId: string, filePath: string): Promise<IndexedFile | null> {
  const knowledge = await getOrBuildRepositoryKnowledge(repoId);
  return knowledge.files.get(filePath) ?? null;
}

export async function findByFilename(repoId: string, name: string): Promise<IndexedFile[]> {
  const knowledge = await getOrBuildRepositoryKnowledge(repoId);
  const results: IndexedFile[] = [];
  const lowerName = name.toLowerCase();
  for (const file of knowledge.files.values()) {
    if (file.name.toLowerCase().includes(lowerName)) {
      results.push(file);
    }
  }
  return results;
}

export async function findByExtension(repoId: string, ext: string): Promise<IndexedFile[]> {
  const knowledge = await getOrBuildRepositoryKnowledge(repoId);
  const results: IndexedFile[] = [];
  const cleanExt = ext.startsWith('.') ? ext.slice(1).toLowerCase() : ext.toLowerCase();
  for (const file of knowledge.files.values()) {
    if (file.extension.toLowerCase() === cleanExt) {
      results.push(file);
    }
  }
  return results;
}

export async function findSymbol(repoId: string, name: string): Promise<IndexedSymbol[]> {
  const knowledge = await getOrBuildRepositoryKnowledge(repoId);
  const results: IndexedSymbol[] = [];
  const lowerName = name.toLowerCase();
  for (const symbolsList of knowledge.symbols.values()) {
    for (const sym of symbolsList) {
      if (sym.name.toLowerCase().includes(lowerName)) {
        results.push(sym);
      }
    }
  }
  return results;
}

export async function findSymbolsByKind(
  repoId: string,
  kind: IndexedSymbol['kind']
): Promise<IndexedSymbol[]> {
  const knowledge = await getOrBuildRepositoryKnowledge(repoId);
  const results: IndexedSymbol[] = [];
  for (const symbolsList of knowledge.symbols.values()) {
    for (const sym of symbolsList) {
      if (sym.kind === kind) {
        results.push(sym);
      }
    }
  }
  return results;
}

export async function getSymbolsInFile(repoId: string, filePath: string): Promise<IndexedSymbol[]> {
  const knowledge = await getOrBuildRepositoryKnowledge(repoId);
  return knowledge.symbols.get(filePath) ?? [];
}

export async function getImports(repoId: string, filePath: string): Promise<string[]> {
  const knowledge = await getOrBuildRepositoryKnowledge(repoId);
  return knowledge.dependencies.get(filePath)?.imports ?? [];
}

export async function getImportedBy(repoId: string, filePath: string): Promise<string[]> {
  const knowledge = await getOrBuildRepositoryKnowledge(repoId);
  return knowledge.dependencies.get(filePath)?.importedBy ?? [];
}
