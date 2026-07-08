import { Project, SourceFile } from 'ts-morph';
import { readRepositoryFilesBulk, getRepository } from '../../repos/repositoryService';
import { setProject } from '../store/repositoryAstStore';
import { IndexedFile, IndexedSymbol, FileDependency } from '../types';
import fs from 'fs';
import path from 'path';

/**
 * Isolated project initialization function.
 * Phase 6.1 can swap this implementation for an in-memory/GitHub-compatible setup
 * without modifying the rest of typescriptIndexer.ts.
 */
async function createProject(repoId: string): Promise<Project> {
  const repo = await getRepository(repoId);
  if (repo && repo.type === 'local' && repo.config.localPath) {
    const tsconfigPath = path.join(repo.config.localPath, 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
      return new Project({ tsConfigFilePath: tsconfigPath });
    }
  }
  return new Project({ useInMemoryFileSystem: true });
}

function getRelativeRepoPath(sourceFile: SourceFile, localPath: string | null): string {
  const filePath = sourceFile.getFilePath();
  if (localPath) {
    const rel = path.relative(localPath, filePath).replace(/\\/g, '/');
    return rel.startsWith('/') ? rel.slice(1) : rel;
  }
  const rel = filePath.replace(/\\/g, '/');
  return rel.startsWith('/') ? rel.slice(1) : rel;
}

function resolveImport(
  declaration: {
    getModuleSpecifierValue(): string | undefined;
    getModuleSpecifierSourceFile?(): SourceFile | undefined;
  },
  currentFilePath: string,
  localPath: string | null,
  allFilePaths: Set<string>
): string | null {
  const specifier = declaration.getModuleSpecifierValue();
  if (!specifier) return null;

  // Try to use ts-morph's internal resolver if available
  if (typeof declaration.getModuleSpecifierSourceFile === 'function') {
    try {
      const resolvedSourceFile = declaration.getModuleSpecifierSourceFile();
      if (resolvedSourceFile) {
        const relPath = getRelativeRepoPath(resolvedSourceFile, localPath);
        if (allFilePaths.has(relPath)) {
          return relPath;
        }
      }
    } catch {
      // Ignore resolution errors and fall back to manual resolution
    }
  }

  // Fallback manual resolution
  if (specifier.startsWith('.')) {
    const dir = path.dirname(currentFilePath);
    const resolved = path.normalize(path.join(dir, specifier)).replace(/\\/g, '/').replace(/^\//, '');
    if (allFilePaths.has(resolved)) return resolved;
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      const withExt = resolved + ext;
      if (allFilePaths.has(withExt)) return withExt;
      const indexWithExt = resolved + '/index' + ext;
      if (allFilePaths.has(indexWithExt)) return indexWithExt;
    }
  } else if (specifier.startsWith('@/')) {
    const resolved = specifier.replace(/^@\//, 'src/').replace(/\\/g, '/');
    if (allFilePaths.has(resolved)) return resolved;
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      const withExt = resolved + ext;
      if (allFilePaths.has(withExt)) return withExt;
      const indexWithExt = resolved + '/index' + ext;
      if (allFilePaths.has(indexWithExt)) return indexWithExt;
    }
  }

  return null;
}

function isReactComponent(name: string, relativePath: string): boolean {
  return /^[A-Z]/.test(name) && /\.(tsx|jsx)$/.test(relativePath);
}

export async function buildTypescriptIndex(
  repoId: string,
  files: Map<string, IndexedFile>
): Promise<{
  symbols: Map<string, IndexedSymbol[]>;
  dependencies: Map<string, FileDependency>;
}> {
  const symbolsMap = new Map<string, IndexedSymbol[]>();
  const dependenciesMap = new Map<string, FileDependency>();

  // 1. Check provider bulk read support
  const tsFiles = Array.from(files.values()).filter((f) => /\.(tsx?|jsx?)$/.test(f.path));
  if (tsFiles.length === 0) {
    return { symbols: symbolsMap, dependencies: dependenciesMap };
  }

  const filePaths = tsFiles.map((f) => f.path);
  const bulkResult = await readRepositoryFilesBulk(repoId, filePaths);
  if (!bulkResult.supported || !bulkResult.contents) {
    return { symbols: symbolsMap, dependencies: dependenciesMap };
  }

  // 2. Initialize ts-morph Project
  const project = await createProject(repoId);
  const repo = await getRepository(repoId);
  const localPath = repo && repo.type === 'local' ? repo.config.localPath : null;

  // 3. Create source files with error handling per file
  for (const file of tsFiles) {
    const content = bulkResult.contents.get(file.path) ?? '';
    try {
      project.createSourceFile(file.path, content);
    } catch (err) {
      console.warn(`[typescriptIndexer] Skipped malformed file creation for ${file.path}:`, err);
    }
  }

  const allFilePaths = new Set(files.keys());

  // 4. Parse symbols and dependencies per file
  for (const file of tsFiles) {
    try {
      const sourceFile = project.getSourceFile(file.path);
      if (!sourceFile) continue;

      const relativePath = file.path;
      const fileSymbols: IndexedSymbol[] = [];

      // Extract functions
      for (const fn of sourceFile.getFunctions()) {
        const name = fn.getName();
        if (!name) continue;
        const line = fn.getStartLineNumber();
        const isExported = fn.isExported() || fn.hasExportKeyword();
        const isComponent = isReactComponent(name, relativePath);
        fileSymbols.push({
          name,
          kind: isComponent ? 'component' : 'function',
          exported: isExported,
          filePath: relativePath,
          line,
        });
      }

      // Extract classes
      for (const cls of sourceFile.getClasses()) {
        const name = cls.getName();
        if (!name) continue;
        const line = cls.getStartLineNumber();
        const isExported = cls.isExported() || cls.hasExportKeyword();
        const isComponent = isReactComponent(name, relativePath);
        fileSymbols.push({
          name,
          kind: isComponent ? 'component' : 'class',
          exported: isExported,
          filePath: relativePath,
          line,
        });
      }

      // Extract interfaces
      for (const intf of sourceFile.getInterfaces()) {
        const name = intf.getName();
        const line = intf.getStartLineNumber();
        const isExported = intf.isExported() || intf.hasExportKeyword();
        fileSymbols.push({
          name,
          kind: 'interface',
          exported: isExported,
          filePath: relativePath,
          line,
        });
      }

      // Extract type aliases
      for (const ta of sourceFile.getTypeAliases()) {
        const name = ta.getName();
        const line = ta.getStartLineNumber();
        const isExported = ta.isExported() || ta.hasExportKeyword();
        fileSymbols.push({
          name,
          kind: 'typeAlias',
          exported: isExported,
          filePath: relativePath,
          line,
        });
      }

      // Extract enums
      for (const en of sourceFile.getEnums()) {
        const name = en.getName();
        const line = en.getStartLineNumber();
        const isExported = en.isExported() || en.hasExportKeyword();
        fileSymbols.push({
          name,
          kind: 'enum',
          exported: isExported,
          filePath: relativePath,
          line,
        });
      }

      // Extract variables (only if component or exported)
      for (const varStmt of sourceFile.getVariableStatements()) {
        const isExported = varStmt.isExported() || varStmt.hasExportKeyword();
        for (const decl of varStmt.getDeclarations()) {
          const name = decl.getName();
          if (!name) continue;
          const isComponent = isReactComponent(name, relativePath);
          if (isComponent || isExported) {
            const line = decl.getStartLineNumber();
            fileSymbols.push({
              name,
              kind: isComponent ? 'component' : 'variable',
              exported: isExported,
              filePath: relativePath,
              line,
            });
          }
        }
      }

      if (fileSymbols.length > 0) {
        symbolsMap.set(relativePath, fileSymbols);
      }

      // Extract dependencies
      const imports: string[] = [];
      const addResolved = (decl: {
        getModuleSpecifierValue(): string | undefined;
        getModuleSpecifierSourceFile?(): SourceFile | undefined;
      }) => {
        const resolved = resolveImport(decl, relativePath, localPath, allFilePaths);
        if (resolved && !imports.includes(resolved)) {
          imports.push(resolved);
        }
      };

      for (const imp of sourceFile.getImportDeclarations()) {
        addResolved(imp);
      }

      for (const exp of sourceFile.getExportDeclarations()) {
        addResolved(exp);
      }

      dependenciesMap.set(relativePath, {
        file: relativePath,
        imports,
        importedBy: [],
      });
    } catch (err) {
      console.warn(`[typescriptIndexer] Skipped parsing individual file ${file.path} due to error:`, err);
    }
  }

  // 5. Cache the Project in AST Store
  setProject(repoId, project);

  // 6. Build the reverse importedBy dependencies map
  for (const [filePath, dep] of dependenciesMap.entries()) {
    for (const impPath of dep.imports) {
      const targetDep = dependenciesMap.get(impPath);
      if (targetDep && !targetDep.importedBy.includes(filePath)) {
        targetDep.importedBy.push(filePath);
      }
    }
  }

  return { symbols: symbolsMap, dependencies: dependenciesMap };
}
