export interface IndexedFile {
  path: string;
  name: string;
  extension: string;
  language: string;
  size: number;
  lastModified: Date;
}

export interface IndexedSymbol {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'typeAlias' | 'enum' | 'component' | 'variable';
  exported: boolean;
  filePath: string;
  line: number;
}

export interface FileDependency {
  file: string;
  imports: string[];
  importedBy: string[];
}

export interface RepositoryKnowledge {
  repoId: string;
  files: Map<string, IndexedFile>;
  symbols: Map<string, IndexedSymbol[]>;   // keyed by filePath
  dependencies: Map<string, FileDependency>;
  indexedAt: Date;
}
