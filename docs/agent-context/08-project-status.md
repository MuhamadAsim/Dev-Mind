## Features Implemented

### Phase 1 — Frontend MVP
- [x] Next.js App Router scaffold
- [x] Tailwind CSS v4 CSS-first design system
- [x] shadcn/ui integration
- [x] Zustand store with auth/ui/chat slices + selector hooks
- [x] Mock auth: localStorage + session cookie, survives refresh
- [x] Route protection middleware
- [x] Login page with animated canvas background
- [x] Dark/light theme toggle (zero flash)
- [x] 3-panel workspace layout (TopBar + Sidebar + Chat + RepoPanel)
- [x] Collapsible sidebar with conversation list, pin/delete, new chat, search
- [x] Chat interface: empty state, suggestion grid
- [x] Chat input: auto-resize, keyboard shortcuts, animated send button
- [x] Message bubbles: user + assistant variants, streaming indicator, copy/feedback
- [x] Keyboard shortcuts: ⌘B, ⌘R, ⌘K

### Phase 2 — AI Integration
- [x] Real AI provider integration
- [x] Streaming AI responses
- [x] Provider abstraction
- [x] Environment-based model configuration
- [x] Server-side AI service architecture
- [x] Vercel AI SDK (`streamText`) for server-side streaming
- [x] OpenRouter as initial AI provider (OpenAI-compatible via `@ai-sdk/openai`)
- [x] Configurable default model via `DEFAULT_AI_MODEL` env var
- [x] System prompt in `aiService.ts`
- [x] SSE streaming: meta → chunk → done events
- [x] Error banner for stream failures (dismissible)

### Phase 3 — Conversation & Persistence
- [x] Conversation persistence (MongoDB via Mongoose)
- [x] Message persistence
- [x] Continue previous conversations
- [x] Conversation pinning
- [x] Conversation deletion
- [x] Optimistic UI during streaming with real-time text append
- [x] Auto-create conversation on first message
- [x] Load conversations on workspace mount
- [x] Lazy-load messages on conversation select
- [x] Delete conversation + cascade delete messages via API
- [x] Conversations removed from Zustand persist (MongoDB is source of truth)
- [x] Long conversation sliding window context limit (configurable)

### Phase 4 — Repository Integration
- [x] `ConnectedRepository` Mongoose model + MongoDB collection
- [x] `RepositoryProvider` interface + `GitHubProvider` (GitHub REST API) + `LocalProvider` (Node.js fs)
- [x] `repositoryService.ts` — connect, disconnect, list, browse, read, search
- [x] `repositoryTools.ts` — thin tool wrappers for future AI agent use
- [x] API routes: `/api/repos`, `/api/repos/[id]`, `/api/repos/[id]/files`, `/api/repos/[id]/file-content`
- [x] `repoSlice.ts` — full Zustand slice for repo state (connectedRepos, filesCache, expandedFolders, search)
- [x] `useRepo.ts` — 20 domain selector + action hooks
- [x] `WorkspaceShell` fetches repos on mount (alongside conversations)
- [x] `ConnectRepoModal` — animated dialog for GitHub (owner/repo or URL) and local path
- [x] `RepositoryPanel` — live file tree, expandable folders, file preview, search, repo selector, disconnect

### Phase 5 — AI ↔ Repository Integration (Foundation)
- [x] Created `src/server/ai/tools.ts` to wrap existing repository tools
- [x] Schema properties mapped to Vercel AI SDK `inputSchema` via `zod`
- [x] Automated injection of `activeRepoId` on backend tool calls
- [x] Configured multi-step loops using `stopWhen: isStepCount(5)` in `streamText`
- [x] Passed client's `activeRepoId` in `ChatInterface` request payload to `/api/chat/stream`

### Phase 6 — Graphify Repository Context Integration
- [x] Installed `@modelcontextprotocol/sdk` as the official MCP client
- [x] Created `src/server/context/` module: `types.ts`, `graphClient.ts`, `graphService.ts`, `contextService.ts`
- [x] `McpGraphClient` wraps `@modelcontextprotocol/sdk` `Client` + `SSEClientTransport`; handles 5s connect timeout and clean lifecycle
- [x] `GraphService` exposes domain-level methods (`explainArchitecture`, `findRelevantFiles`, `findDependencies`, `findRelatedSymbols`, `findCallHierarchy`, `findEntryPoints`)
- [x] `getCapabilities()` discovers server tools at runtime via `listTools()` — no hardcoded assumptions
- [x] `getGraphStatus()` detects indexing via server responses only — never inspects local file paths
- [x] Graceful fallback: if offline/not-indexed `createContextTools()` returns `{}` silently
- [x] `createContextTools(session)` dynamically registers discovered MCP tools as Vercel AI SDK tools
- [x] `jsonSchemaToZod()` converts Graphify JSON Schema input schemas to Zod at runtime
- [x] Merged repo tools + context tools in `openrouter.ts` before every `streamText` call
- [x] Updated `SYSTEM_PROMPT` with Graphify usage strategy for the LLM
- [x] `verify-graph.ts` dev verification script (capability discovery + graceful offline handling confirmed)
- [x] Build passes clean (TypeScript strict mode)

---

## Planned Features (Remaining)

- [ ] GitHub OAuth
- [ ] Markdown rendering with code syntax highlighting (react-markdown + shiki)
- [ ] Command palette (⌘K) — quick nav, search, actions
- [ ] Model selector in TopBar (functional, not UI-only)
- [ ] LangGraph agent integration
- [ ] RAG — file parsing, chunking, embeddings, vector DB, semantic search
- [x] MCP (Model Context Protocol) — Graphify context engine integrated via official SDK
- [ ] MCP (Model Context Protocol) — filesystem, GitHub, terminal, browser tools (future)
- [ ] Multi-agent system (Engineer, Reviewer, Debugger, Docs, Tests, Security)
- [ ] File attachments
- [ ] Voice input
- [ ] Mobile sidebar drawer
- [ ] Settings page

---

## Future Improvements

- [ ] Conversation renaming
- [ ] Auto-generated conversation titles
- [x] Long conversation handling (sliding window)
- [ ] Token-aware context management
- [ ] Conversation summarization
- [ ] Export/import conversations
- [ ] Semantic memory

---

## Known Issues / TODOs

- [ ] Conversation rename has no UI trigger (API + hook ready: `PATCH /api/conversations/[id]`)
- [ ] Model selector in TopBar is UI-only (no actual model switching yet)
- [ ] Settings button has no page/modal yet
- [ ] Mobile layout: sidebar hides on collapse but no drawer fallback
- [ ] Search bar in sidebar is UI-only (no filtering logic yet)
- [ ] Pin conversation is client-side only (not persisted to DB yet)
- [ ] No conversation pagination (loads all messages at once)
- [ ] GitHub API rate limit: unauthenticated requests limited to 60/hr — set `GITHUB_TOKEN` env var to increase
- [ ] File preview is plain text only — no syntax highlighting yet (react-markdown + shiki planned)
- [ ] Repository file search uses GitHub code search API, which may rate-limit quickly without a token
- [ ] `repoSlice` search makes two fetch calls in `searchRepoFiles` (one dead, one live) — cleanup needed

---

