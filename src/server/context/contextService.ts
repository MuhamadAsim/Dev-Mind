// ============================================================
// Context Service
// Coordinates repository and graph context queries
// ============================================================
import { GraphService } from './graphService';
import { getRepository } from '../repos/repositoryService';

export class ContextService {
  private graphService: GraphService;

  constructor() {
    this.graphService = new GraphService();
  }

  /**
   * Determine if a repository supports Graphify context queries.
   * Supports only LocalProvider.
   */
  async supportsGraphify(repoId: string): Promise<boolean> {
    const repo = await getRepository(repoId);
    return repo?.type === 'local';
  }

  /**
   * Retrieve GraphService instance
   */
  getGraph(): GraphService {
    return this.graphService;
  }
}

// Global Singleton
export const contextService = new ContextService();
