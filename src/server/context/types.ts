// ============================================================
// Context Layer Types
// ============================================================

export interface ContextQueryResult {
  rawResponse: string;
  nodes: Array<{
    id: string;
    label: string;
    sourceFile?: string;
    location?: string;
    community?: string;
    degree?: number;
    fileType?: string;
  }>;
  edges: Array<{
    source: string;
    target: string;
    relation: string;
    confidence?: string;
  }>;
}

export interface DependencyRelation {
  source: string;
  target: string;
  type: string;
  confidence?: string;
}

export interface SymbolRelationship {
  name: string;
  kind: string;
  sourceFile: string;
  relatedSymbols: Array<{
    name: string;
    relation: string;
  }>;
}

export interface CallHierarchy {
  symbol: string;
  caller?: string;
  callee?: string;
  relation: string;
}

export interface GraphCapabilities {
  hasQueryGraph: boolean;
  hasGetNode: boolean;
  hasGetNeighbors: boolean;
  hasGetCommunity: boolean;
  hasGodNodes: boolean;
  hasGraphStats: boolean;
  hasShortestPath: boolean;
}

export interface GraphStatusResult {
  status: 'indexed' | 'not_indexed' | 'offline';
  message?: string;
  stats?: {
    nodes: number;
    edges: number;
    communities: number;
  };
}
