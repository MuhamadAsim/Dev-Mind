// ============================================================
// Repository Provider
//
// Retrieves query-relevant repository context using Graphify.
// Lightweight by design — fetches only files relevant to the
// current request, not a broad architecture dump.
//
// Stateless — no shared state with other providers.
// Does NOT modify Graphify or any existing context tooling.
// ============================================================
import type { RouterInput, ProviderResult, IContextProvider, ContextEntry } from '../types';
import { contextService } from '../../context/contextService';

/** Maximum number of file-hint entries to include (avoids token bloat). */
const MAX_FILE_HINTS = 8;

/** Maximum characters of raw graph traversal output to include. */
const MAX_GRAPH_TEXT_CHARS = 1800;

export class RepositoryProvider implements IContextProvider {
  readonly name = 'repository' as const;

  async provide(input: RouterInput): Promise<ProviderResult | null> {
    const { userMessage, activeRepositoryId } = input;

    if (!activeRepositoryId) return null;

    try {
      // Graphify only supports local repositories
      const isSupported = await contextService.supportsGraphify(activeRepositoryId);
      if (!isSupported) {
        console.log('[repositoryProvider] Repo is not a local repo — Graphify not applicable.');
        return null;
      }

      const graphService = contextService.getGraph();
      const status = await graphService.getGraphStatus(activeRepositoryId);

      if (status.status !== 'indexed') {
        console.log(`[repositoryProvider] Graphify status: ${status.status} — skipping.`);
        return null;
      }

      // Use findRelevantFiles with the user's query for targeted retrieval.
      // This is query-scoped (BFS traversal seeded by the question) rather
      // than a broad architecture summary.
      const relevantGraph = await graphService.findRelevantFiles(activeRepositoryId, userMessage);

      if (relevantGraph.nodes.length === 0 && !relevantGraph.rawResponse) {
        return null;
      }

      const entries: ContextEntry[] = [];

      // File-hint entries — one per relevant node with a source file
      const nodesWithFiles = relevantGraph.nodes
        .filter(n => n.sourceFile)
        .slice(0, MAX_FILE_HINTS);

      for (const node of nodesWithFiles) {
        entries.push({
          type: 'file-hint',
          content: `${node.label} → ${node.sourceFile}`,
          source: node.sourceFile,
          metadata: {
            nodeId: node.id,
            community: node.community,
            location: node.location,
          },
        });
      }

      // Graph traversal summary — rich semantic context, character-capped
      if (relevantGraph.rawResponse) {
        const trimmed = relevantGraph.rawResponse.slice(0, MAX_GRAPH_TEXT_CHARS);
        const wasTrimmed = relevantGraph.rawResponse.length > MAX_GRAPH_TEXT_CHARS;
        entries.push({
          type: 'graph-summary',
          content: wasTrimmed ? trimmed + '\n…(graph output truncated)' : trimmed,
          metadata: {
            nodeCount: relevantGraph.nodes.length,
            edgeCount: relevantGraph.edges.length,
            truncated: wasTrimmed,
          },
        });
      }

      if (entries.length === 0) return null;

      console.log(`[repositoryProvider] ${entries.length} entries (${nodesWithFiles.length} file hints + graph summary)`);

      return {
        provider: 'repository',
        entries,
        metadata: {
          repoId: activeRepositoryId,
          graphStatus: status.status,
          nodeCount: relevantGraph.nodes.length,
          edgeCount: relevantGraph.edges.length,
        },
      };
    } catch (err: any) {
      console.error('[repositoryProvider] Failed to retrieve repository context:', err?.message ?? err);
      return null;
    }
  }
}
