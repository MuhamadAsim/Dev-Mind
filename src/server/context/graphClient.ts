// ============================================================
// Graphify MCP Client
// ============================================================
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export interface McpToolResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

export class McpGraphClient {
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  private url: string;

  constructor(url: string = process.env.GRAPHIFY_MCP_URL || 'http://localhost:5001/mcp') {
    this.url = url;
  }

  async connect(): Promise<void> {
    if (this.client) return;

    try {
      const mcpUrl = new URL(this.url);
      this.transport = new StreamableHTTPClientTransport(mcpUrl);

      this.client = new Client(
        {
          name: 'devmind-ai-client',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Connect to the transport with a 5-second timeout
      const connectPromise = this.client.connect(this.transport);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('MCP server connection timed out')), 5000)
      );

      await Promise.race([connectPromise, timeoutPromise]);
    } catch (error) {
      console.warn('[McpGraphClient] Connection failed:', error instanceof Error ? error.message : error);
      this.client = null;
      this.transport = null;
      throw error;
    }
  }

  async listTools() {
    if (!this.client) {
      await this.connect();
    }
    return this.client!.listTools();
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
    if (!this.client) {
      await this.connect();
    }
    const result = await this.client!.callTool({
      name,
      arguments: args,
    });
    // The SDK types content as {} for flexibility; we narrow it here
    return result as unknown as McpToolResult;
  }

  async close(): Promise<void> {
    try {
      if (this.transport) {
        await this.transport.close();
      }
    } catch (err) {
      console.warn('[McpGraphClient] Error closing transport:', err);
    } finally {
      this.client = null;
      this.transport = null;
    }
  }
}