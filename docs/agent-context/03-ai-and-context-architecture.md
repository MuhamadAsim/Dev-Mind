### 11. Context Layer Architecture (Phase 6)

```
AI Service
    │
    ▼
Context Service
    │
    ├──────── Repository Service (Local / GitHub filesystem)
    │
    └──────── Graph Service (Codebase semantic understanding)
                 │
                 ▼
          McpGraphClient (@modelcontextprotocol/sdk)
                 │
                 ▼
          Graphify MCP Server (HTTP/SSE on GRAPHIFY_MCP_URL)
```

**Key rules:**
- `ContextService` is the only entry point for the rest of DevMind to access semantic context.
- `GraphService` exposes domain-level methods; nothing outside `src/server/context/` ever knows about Graphify MCP tool names.
- `McpGraphClient` wraps the official `@modelcontextprotocol/sdk` `Client` + `SSEClientTransport`.
- Graphify is only supported for **LocalProvider** repositories. GitHub repos skip the context layer silently.
- If the Graphify server is offline, unreachable, or the graph is not yet indexed, `GraphService` returns a structured `GraphStatusResult` and all context tools are skipped — the rest of DevMind falls back to standard repo tools transparently.
- Indexing state is determined exclusively from MCP server responses, **never** from inspecting local file paths.

**`src/server/context/` module summary:**

| File | Purpose |
|---|---|
| `types.ts` | `ContextQueryResult`, `DependencyRelation`, `SymbolRelationship`, `CallHierarchy`, `GraphCapabilities`, `GraphStatusResult` |
| `graphClient.ts` | `McpGraphClient` — connects to MCP server, exposes `listTools()` and `callTool()` with `McpToolResult` type |
| `graphService.ts` | Domain methods: `explainArchitecture`, `findRelevantFiles`, `findDependencies`, `findRelatedSymbols`, `findCallHierarchy`, `findEntryPoints`, `getCapabilities`, `getGraphStatus` |
| `contextService.ts` | `ContextService` singleton — determines LocalProvider support, routes to `GraphService` |
| `verify-graph.ts` | Dev-time verification script: connect → listTools → getGraphStatus |

**Graphify MCP Tools (verified from `serve.py` source):**

| MCP Tool | GraphService Method | Description |
|---|---|---|
| `query_graph` | `findRelevantFiles` | BFS/DFS traversal — returns nodes + edges as text |
| `get_node` | `findRelatedSymbols` | Details for a node by label/ID |
| `get_neighbors` | `findDependencies`, `findCallHierarchy`, `findRelatedSymbols` | Direct neighbors with edge metadata |
| `get_community` | (direct) | All nodes in a community by ID |
| `god_nodes` | `explainArchitecture`, `findEntryPoints` | Most-connected nodes (core abstractions) |
| `graph_stats` | `explainArchitecture`, `getGraphStatus` | Graph statistics (nodes, edges, communities) |
| `shortest_path` | (direct) | Shortest path between two concepts |

**AI Tool Registration:**
- `createContextTools(session)` in `src/server/ai/tools.ts` is called alongside `createRepositoryTools(session)` before every `streamText` call.
- It connects to the MCP server, calls `listTools()`, converts JSON Schema to Zod via `jsonSchemaToZod()`, and registers each tool dynamically.
- If Graphify is offline or the repo is GitHub-type, `createContextTools` returns `{}` with no error.
- All AI tool execution goes: LLM tool call → AI Tool → `McpGraphClient.callTool()` → Graphify MCP Server.

**Runtime system prompt** (in `aiService.ts`) instructs the LLM to:
1. Prefer semantic discovery (graph tools) before broad file reads.
2. Use `query_graph`, `get_node`, `god_nodes`, etc. to understand architecture, dependencies, symbols first.
3. Only read file contents via `readFile` once relevant locations are identified.
4. Fall back to `searchFiles` / `listDirectory` if Graphify is unavailable or not indexed.

---

### 16. Response Mode Decision & Routing (Phase 11)

Coordinates with the Context Orchestration layer to determine the appropriate delivery channel (`text`, `voice`, or `both`) for each turn.

```
User Message + Context Signals
            │
            ▼
Response Mode Intent Router (determineResponseMode)
            │
            ├── 1. Explicit Both ("text and voice", "voice too")        → 'both'
            ├── 2. Explicit Voice ("send as voice", "reply with voice")  → 'voice' (overrides code/actions)
            ├── 3. Mutations / Actions / Uploads ("Delete doc", "Fix code") → 'text'
            ├── 4. Knowledge Base Informational / Retrieval ("What is in doc?") → 'voice'
            └── 5. Technical Topics / Default                            → 'text'
```

- **Clean Decoupling**: Voice synthesis is performed on the **final AI answer**, never on raw retrieval chunks or system tokens.
- **Fail-Safe Fallback**: If speech synthesis fails, times out, or the API key is unconfigured, WhatsApp automatically falls back to delivering formatted text.


