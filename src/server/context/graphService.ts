// ============================================================
// Graph Service
// maps domain-level concepts to Graphify MCP tool calls
// ============================================================
import { McpGraphClient } from './graphClient';
import {
  ContextQueryResult,
  DependencyRelation,
  SymbolRelationship,
  CallHierarchy,
  GraphCapabilities,
  GraphStatusResult,
} from './types';
import { getRepository } from '../repos/repositoryService';

export class GraphService {
  private client: McpGraphClient;

  constructor() {
    this.client = new McpGraphClient();
  }

  /**
   * Helper to execute a block of code with an active connection,
   * cleaning up resources afterwards.
   */
  private async executeOnClient<T>(fn: (client: McpGraphClient) => Promise<T>): Promise<T> {
    const client = new McpGraphClient();
    try {
      await client.connect();
      return await fn(client);
    } finally {
      await client.close();
    }
  }

  /**
   * Discover which tools are officially supported by the connected Graphify MCP server.
   */
  async getCapabilities(): Promise<GraphCapabilities> {
    try {
      return await this.executeOnClient(async (client) => {
        const toolsResult = await client.listTools();
        const toolNames = new Set((toolsResult.tools || []).map((t) => t.name));

        return {
          hasQueryGraph: toolNames.has('query_graph'),
          hasGetNode: toolNames.has('get_node'),
          hasGetNeighbors: toolNames.has('get_neighbors'),
          hasGetCommunity: toolNames.has('get_community'),
          hasGodNodes: toolNames.has('god_nodes'),
          hasGraphStats: toolNames.has('graph_stats'),
          hasShortestPath: toolNames.has('shortest_path'),
        };
      });
    } catch {
      return {
        hasQueryGraph: false,
        hasGetNode: false,
        hasGetNeighbors: false,
        hasGetCommunity: false,
        hasGodNodes: false,
        hasGraphStats: false,
        hasShortestPath: false,
      };
    }
  }

  /**
   * Checks indexing status by attempting to connect or call basic tools.
   */
  async getGraphStatus(repoId: string): Promise<GraphStatusResult> {
    const repo = await getRepository(repoId);
    if (!repo || repo.type !== 'local') {
      return { status: 'offline', message: 'Repository is not local' };
    }

    try {
      return await this.executeOnClient(async (client) => {
        // Run graph_stats to see if graph data exists
        const cap = await this.getCapabilities();
        if (!cap.hasGraphStats) {
          return { status: 'offline', message: 'graph_stats tool not supported on server' };
        }

        try {
          const statsResult = await client.callTool('graph_stats', {});
          const text = statsResult.content?.[0]?.text || '';
          
          if (text.includes('error') || text.includes('FileNotFoundError') || text.includes('not found')) {
            return { status: 'not_indexed', message: text };
          }

          // Parse stats if available
          const nodesMatch = text.match(/Nodes:\s*(\d+)/i);
          const edgesMatch = text.match(/Edges:\s*(\d+)/i);
          const commsMatch = text.match(/Communities:\s*(\d+)/i);

          return {
            status: 'indexed',
            stats: {
              nodes: nodesMatch ? parseInt(nodesMatch[1], 10) : 0,
              edges: edgesMatch ? parseInt(edgesMatch[1], 10) : 0,
              communities: commsMatch ? parseInt(commsMatch[1], 10) : 0,
            },
          };
        } catch (err: any) {
          const errMsg = String(err.message || err);
          if (errMsg.includes('FileNotFoundError') || errMsg.includes('not found') || errMsg.includes('does not exist')) {
            return { status: 'not_indexed', message: errMsg };
          }
          throw err;
        }
      });
    } catch (error: any) {
      return {
        status: 'offline',
        message: `Graphify MCP server is disconnected or unreachable: ${error.message || error}`,
      };
    }
  }

  /**
   * Domain-level: Explain Codebase/Repository Architecture
   */
  async explainArchitecture(repoId: string): Promise<string> {
    const status = await this.getGraphStatus(repoId);
    if (status.status !== 'indexed') {
      return `Cannot explain architecture: Graphify server is ${status.status} (${status.message || ''})`;
    }

    return this.executeOnClient(async (client) => {
      const cap = await this.getCapabilities();
      let output = '';

      if (cap.hasGraphStats) {
        const stats = await client.callTool('graph_stats', {});
        output += `### Codebase Metrics\n${stats.content?.[0]?.text || ''}\n\n`;
      }

      if (cap.hasGodNodes) {
        const god = await client.callTool('god_nodes', { top_n: 10 });
        output += `### Core Codebase Abstractions\n${god.content?.[0]?.text || ''}\n`;
      } else if (cap.hasQueryGraph) {
        const fallback = await client.callTool('query_graph', { question: 'core abstractions entry points' });
        output += `### Core Codebase Abstractions\n${fallback.content?.[0]?.text || ''}\n`;
      }

      return output || 'No architectural details returned by server.';
    });
  }

  /**
   * Domain-level: Search and identify relevant files based on user query
   */
  async findRelevantFiles(repoId: string, question: string): Promise<ContextQueryResult> {
    const defaultResult: ContextQueryResult = { rawResponse: '', nodes: [], edges: [] };
    const status = await this.getGraphStatus(repoId);
    if (status.status !== 'indexed') return defaultResult;

    return this.executeOnClient(async (client) => {
      const cap = await this.getCapabilities();
      if (!cap.hasQueryGraph) return defaultResult;

      const result = await client.callTool('query_graph', { question, mode: 'bfs', depth: 3 });
      const rawText = result.content?.[0]?.text || '';

      // Parse BFS traversal result text to reconstruct nodes/edges
      const nodes: any[] = [];
      const edges: any[] = [];

      const lines = rawText.split('\n');
      for (const line of lines) {
        if (line.startsWith('NODE ')) {
          // Format: NODE label [src=... loc=... community=...]
          const labelMatch = line.match(/^NODE\s+(.+?)\s+\[/);
          const srcMatch = line.match(/src=(.+?)(?:\s|$|\])/);
          const locMatch = line.match(/loc=(.+?)(?:\s|$|\])/);
          const commMatch = line.match(/community=(.+?)(?:\s|$|\])/);
          
          if (labelMatch) {
            nodes.push({
              id: labelMatch[1],
              label: labelMatch[1],
              sourceFile: srcMatch ? srcMatch[1] : undefined,
              location: locMatch ? locMatch[1] : undefined,
              community: commMatch ? commMatch[1] : undefined,
            });
          }
        } else if (line.startsWith('EDGE ')) {
          // Format: EDGE label1 --relation [confidence]--> label2
          const edgeMatch = line.match(/^EDGE\s+(.+?)\s+--(.+?)\s+\[(.*?)\]-->\s+(.+)$/);
          if (edgeMatch) {
            edges.push({
              source: edgeMatch[1],
              relation: edgeMatch[2],
              confidence: edgeMatch[3] || undefined,
              target: edgeMatch[4],
            });
          }
        }
      }

      return {
        rawResponse: rawText,
        nodes,
        edges,
      };
    });
  }

  /**
   * Domain-level: Find codebase dependencies of a module/class
   */
  async findDependencies(repoId: string, symbol: string): Promise<DependencyRelation[]> {
    const status = await this.getGraphStatus(repoId);
    if (status.status !== 'indexed') return [];

    return this.executeOnClient(async (client) => {
      const cap = await this.getCapabilities();
      if (!cap.hasGetNeighbors) return [];

      const result = await client.callTool('get_neighbors', { label: symbol, relation_filter: 'depends' });
      const rawText = result.content?.[0]?.text || '';

      const dependencies: DependencyRelation[] = [];
      const lines = rawText.split('\n');
      for (const line of lines) {
        if (line.includes('-->')) {
          const match = line.match(/-->\s+(.+?)\s+\[(.*?)\]/);
          if (match) {
            dependencies.push({
              source: symbol,
              target: match[1],
              type: match[2] || 'depends',
            });
          }
        }
      }
      return dependencies;
    });
  }

  /**
   * Domain-level: Find related symbols (e.g. types/classes/interfaces)
   */
  async findRelatedSymbols(repoId: string, symbol: string): Promise<SymbolRelationship | null> {
    const status = await this.getGraphStatus(repoId);
    if (status.status !== 'indexed') return null;

    return this.executeOnClient(async (client) => {
      const cap = await this.getCapabilities();
      if (!cap.hasGetNode) return null;

      const nodeResult = await client.callTool('get_node', { label: symbol });
      const nodeText = nodeResult.content?.[0]?.text || '';
      if (nodeText.includes('No node matching')) return null;

      // Extract source file
      const fileMatch = nodeText.match(/Source:\s*(.+?)(?:\s+\d+|\r|\n|$)/);
      const sourceFile = fileMatch ? fileMatch[1].trim() : '';

      const related: any[] = [];
      if (cap.hasGetNeighbors) {
        const neighborsResult = await client.callTool('get_neighbors', { label: symbol });
        const neighborsText = neighborsResult.content?.[0]?.text || '';
        const lines = neighborsText.split('\n');
        for (const line of lines) {
          if (line.includes('-->')) {
            const match = line.match(/-->\s+(.+?)\s+\[(.*?)\]/);
            if (match) {
              related.push({
                name: match[1],
                relation: match[2] || 'relates',
              });
            }
          }
        }
      }

      return {
        name: symbol,
        kind: 'class',
        sourceFile,
        relatedSymbols: related,
      };
    });
  }

  /**
   * Domain-level: Find caller/callee relationships
   */
  async findCallHierarchy(repoId: string, symbol: string): Promise<CallHierarchy[]> {
    const status = await this.getGraphStatus(repoId);
    if (status.status !== 'indexed') return [];

    return this.executeOnClient(async (client) => {
      const cap = await this.getCapabilities();
      if (!cap.hasGetNeighbors) return [];

      const result = await client.callTool('get_neighbors', { label: symbol, relation_filter: 'calls' });
      const rawText = result.content?.[0]?.text || '';

      const hierarchy: CallHierarchy[] = [];
      const lines = rawText.split('\n');
      for (const line of lines) {
        if (line.includes('-->')) {
          const match = line.match(/-->\s+(.+?)\s+\[(.*?)\]/);
          if (match) {
            hierarchy.push({
              symbol,
              callee: match[1],
              relation: match[2] || 'calls',
            });
          }
        }
      }
      return hierarchy;
    });
  }

  /**
   * Domain-level: Discover the core entrance points of the codebase
   */
  async findEntryPoints(repoId: string): Promise<string[]> {
    const status = await this.getGraphStatus(repoId);
    if (status.status !== 'indexed') return [];

    return this.executeOnClient(async (client) => {
      const cap = await this.getCapabilities();
      if (cap.hasGodNodes) {
        const result = await client.callTool('god_nodes', { top_n: 5 });
        const rawText = result.content?.[0]?.text || '';
        
        const entries: string[] = [];
        const lines = rawText.split('\n');
        for (const line of lines) {
          const match = line.match(/\d+\.\s+(.+?)\s+-/);
          if (match) {
            entries.push(match[1]);
          }
        }
        return entries;
      }
      return [];
    });
  }
}
