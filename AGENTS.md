# AGENTS.md — DevMind AI Project Memory

> **READ THIS FIRST** before making any changes to this codebase.  
> This file is the single source of truth for AI assistants and developers.  
> **Update this file** whenever major architecture or feature changes are made.

---

## Project Identity

| Field | Value |
|---|---|
| **Name** | DevMind AI |
| **Type** | Personal AI Software Engineering Workspace |
| **Vision** | AI coding assistant (ChatGPT + Cursor + Claude) for a single developer. Fully functional AI chat application with persistent conversation history and WhatsApp messaging integration. |
| **Phase** | Phase 9 — RAG Backend & AI Tools |
| **Location** | `c:\Users\ranah\Desktop\assistant` |

---

## Tech Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | Next.js | 16.x | App Router, Server + Client Components |
| Language | TypeScript | 5.x | Strict mode — **no `any`** |
| Styling | Tailwind CSS | v4 | CSS-first config via `@theme` in `globals.css` |
| UI Primitives | shadcn/ui | latest | Components in `src/components/ui/` |
| Animations | Framer Motion | latest | In-component only |
| State Management | Zustand | v5 | Slice pattern + atomic selector hooks |
| Theming | next-themes | latest | Dark default, no hydration flash |
| Icons | lucide-react | latest | Consistent with shadcn |
| Route Protection | Next.js Middleware | built-in | Cookie-based (`devmind_session`) |
| Page Transitions | View Transitions API | experimental | `viewTransition: true` in `next.config.ts` |
| Fonts | Geist / Geist Mono | via next/font | Zero-layout-shift font loading |
| AI SDK | Vercel AI SDK (`ai`) | latest | Server-side `streamText` only |
| AI Provider | `@ai-sdk/openai` | latest | OpenAI-compatible — pointed at OpenRouter |
| Database | MongoDB | Atlas or local | Via Mongoose ODM |
| ODM | Mongoose | latest | Two collections: Conversation + Message |
| Graph Context | Graphify (`graphifyy[mcp]`) | latest | Knowledge graph MCP server for local repos |
| WhatsApp | `whatsapp-web.js` | latest | WhatsApp Web client via Puppeteer — server-only |
| QR Renderer | `qrcode-terminal` | latest | Renders QR code to terminal for first-time auth |
| MCP Client | `@modelcontextprotocol/sdk` | latest | Official SSE/Streamable-HTTP client for Graphify |

---

## Architecture Decisions

### 1. Route Groups
```
src/app/
├── (auth)/login/              → /login  (no shared layout, full-screen bg)
├── (workspace)/workspace/     → /workspace (3-panel shell)
├── api/
│   ├── chat/stream/           → POST  (SSE streaming endpoint)
│   └── conversations/
│       ├── route.ts           → GET   (list all)
│       └── [id]/
│           ├── route.ts       → GET / PATCH / DELETE
│           └── messages/route.ts → GET (lazy-load messages)
├── layout.tsx                 → Root layout (fonts, ThemeProvider, TooltipProvider)
└── page.tsx                   → Server Component redirect (/ → /login or /workspace)
```

### 2. Authentication (Mock — Replace Later)
- **Login**: `loginMock()` in `src/lib/auth.ts` stores `MockUser` in `localStorage` key `devmind_user` AND sets a `devmind_session` cookie
- **Logout**: `logoutMock()` clears both localStorage and the cookie
- **Server protection**: `src/middleware.ts` reads `devmind_session` cookie to guard `/workspace`
- **Client hydration**: `useInitAuth()` in `WorkspaceShell` reads localStorage on mount to populate Zustand
- **Replace point**: Swap `src/lib/auth.ts` with real GitHub OAuth — `MockUser` shape mirrors GitHub OAuth response

### 3. Zustand Store (Slice Pattern)
```
src/store/
├── index.ts                    ← Root store (devtools + persist)
├── slices/
│   ├── authSlice.ts            ← user, isAuthenticated, isLoading, login, logout, initAuth
│   ├── uiSlice.ts              ← theme, isSidebarOpen, isRepoPanelOpen, widths, commandPalette
│   ├── chatSlice.ts            ← conversations, activeConversationId, CRUD + streaming actions
│   └── repoSlice.ts            ← connectedRepos, activeRepoId, filesCache, expandedFolders, search
└── hooks/
    ├── useAuth.ts              ← Auth selector hooks (ONLY import from here, not useStore)
    ├── useUI.ts                ← UI selector hooks
    ├── useChat.ts              ← Chat selector hooks
    └── useRepo.ts              ← Repo selector hooks (20 atomic selectors + action hooks)
```

**Rule**: Components **never** import `useStore` directly. Always use domain hooks.

**Persist config** (Zustand persist middleware): Only `theme`, `isSidebarOpen`, `isRepoPanelOpen` are persisted.  
**Conversations and repos are NOT persisted to localStorage** — MongoDB is the source of truth. Zustand is a session-time cache.

### 4. Client/Server Component Split
- `app/**/page.tsx` → Server Components (metadata, redirects)
- `app/layout.tsx` → Server Component (fonts, providers)
- `app/api/**` → Next.js Route Handlers (server-side, Node.js runtime)
- All interactive UI → `'use client'` (sidebar, chat, animations)
- **Never** access `localStorage` or `document` in Server Components
- **All Mongoose/AI code is server-only** — lives in `src/server/`

### 5. Animation Strategy
| Use Case | Tool |
|---|---|
| Route transitions | View Transitions API |
| Sidebar/panel collapse | Framer Motion `AnimatePresence` + `motion.aside` |
| Message appearance | Framer Motion stagger |
| Button micro-interactions | `whileHover`, `whileTap` |
| Theme icon swap | `AnimatePresence` mode="wait" |

### 6. Tailwind v4 Configuration
- **No** `tailwind.config.ts` theme block — all design tokens in `globals.css` under `@theme {}`
- shadcn CSS variables bridged to our tokens under `:root {}`
- Light mode overrides under `.light {}` class

### 7. AI Provider Architecture
```
User → API Route → AI Service → AI Provider → OpenRouter/OpenAI-compatible API → Stream Response → Persist Assistant Message
```
- **`src/server/ai/types.ts`**: `AIMessage` and `AIProvider` interface. Every provider implements this.
- **`src/server/ai/aiService.ts`**: Single entry-point. Builds system prompt, selects provider, exposes `streamChat()`.
- **`src/server/ai/providers/openrouter.ts`**: OpenRouter implementation using `@ai-sdk/openai` pointed at `https://openrouter.ai/api/v1`.
- **To add a new provider**: Create `src/server/ai/providers/<name>.ts`, add a `case` in `aiService.ts`, set `ACTIVE_AI_PROVIDER` env var.
- The Vercel AI SDK `useChat` hook is **intentionally not used** — Zustand manages all state.

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

### 8. Database Architecture (Phase 2 + 4 + 7 + 8)
Seven separate MongoDB collections:

| Collection | Purpose |
|---|---|
| `conversations` | Conversation metadata only (title, aiModel, timestamps, metadata) |
| `messages` | All messages with `conversationId` foreign key |
| `connectedrepositories` | Connected GitHub/local repos with provider config + cached metadata |
| `whatsappsessions` | Per-phone-number session: linked `conversationId`, `activeRepositoryId`, `preferredModel`, `lastSeen` |
| `knowledgebases` | Knowledge Base metadata, description, and embeddingModel configurations |
| `kbdocuments` | Document records with status, storagePath, sizeBytes, parsing metadata |
| `documentchunks` | Document text chunks with 384-dim embedding vectors for Atlas Vector Search |

**Why separate collections (not embedded)?**
- Efficient pagination for large conversations
- Independent indexing on `role`, `type`, `createdAt`
- Granular message updates without rewriting the whole document
- Ready for future tool-call results, RAG citations, MCP outputs
- Scales to thousands of messages per conversation

### 12. Chat Orchestrator Architecture (Phase 7)

The `ChatOrchestrator` is the shared brain for all AI clients (Web, WhatsApp, future Telegram/CLI).
It decouples client-specific transport from core AI chat logic.

```
Any Client (Web SSE, WhatsApp, ...)
    │
    ▼
ChatOrchestrator.startChatTurn(context, userMessage)
    │
    ├── Create / validate conversation in DB
    ├── Save user message to DB
    ├── Check for pending write confirmation (confirm/reject loop)
    └── Call aiService.streamChat() → return { stream, session, finalize }

Client consumes stream:
    Web → SSE chunks to browser
    WhatsApp → buffer full response → message.reply()

Client calls finalize(fullContent):
    → Saves assistant message to DB
    → Persists pendingWrite (if any) for confirmation on next turn
```

**Key types** in `src/server/chat/types.ts`:
- `ChatSessionContext` — `{ clientType, conversationId, activeRepositoryId, model, metadata }`
- `StartChatTurnResult` — `{ conversationId, assistantMessageId, stream, session, finalize }`

**`ClientType`** is an open union (`'web' | 'whatsapp' | (string & {})`) — adding a new client never requires editing `types.ts`.

### 13. WhatsApp Integration Architecture (Phase 7)

```
WhatsApp Message (user phone)
    │
    ▼
whatsapp-web.js Client (singleton, Puppeteer-backed)
    │
    ▼
messageHandler.handleIncomingMessage()
    │
    ├── Allowlist check (WHATSAPP_ALLOWED_NUMBERS env var)
    ├── Group chat filter (drop @g.us messages)
    ├── Non-text reject (image/video/sticker → "text only")
    ├── Load / create WhatsappSession from MongoDB
    ├── Slash command? → commandHandler.handleCommand()
    │       /repos, /repo <name>, /current, /help
    └── AI Turn → acquireLock(phoneNumber) → ChatOrchestrator.startChatTurn()
            │
            ├── Buffer full stream
            ├── finalize() → save to DB
            ├── formatForWhatsApp() → Markdown → WhatsApp markup
            └── chunkMessage() → split at 3500 chars → reply in sequence
```

**Module summary** — `src/server/whatsapp/`:

| File | Purpose |
|---|---|
| `client.ts` | `getWhatsappClient()` singleton, `initializeWhatsapp()`. Auto-detects Chrome/Edge path. |
| `startup.ts` | `initWhatsapp()` — thin error-resilient wrapper called from `instrumentation.ts` |
| `messageHandler.ts` | Entry point for all incoming messages. Allowlist, lock queue, AI turn orchestration. |
| `commandHandler.ts` | Handles `/repos`, `/repo <name>`, `/current`, `/help` slash commands |
| `sessionService.ts` | `getOrCreateSession()`, `updateSessionConversation()`, `updateSessionRepository()` |
| `formatting.ts` | `formatForWhatsApp()` (Markdown → WA markup), `chunkMessage()` (3500-char safe splitter) |
| `types.ts` | Shared WhatsApp-specific types |

**Startup**: `src/instrumentation.ts` uses Next.js `register()` hook to call `initWhatsapp()` when `NEXT_RUNTIME === 'nodejs'`. WhatsApp initialisation runs in the background — a startup failure never blocks the web app.

**Phone number allowlist**: Comma-separated E.164 digits in `WHATSAPP_ALLOWED_NUMBERS`. Messages from unlisted numbers are silently dropped.

**Per-number lock queue**: `acquireLock(phoneNumber, fn)` ensures concurrent messages from the same number are processed sequentially — no race conditions on conversation state.

**`IWhatsappSession`** (server/db/models/WhatsappSession.ts):
```typescript
{
  phoneNumber: string;           // unique — stripped of non-digits
  conversationId: string | null; // linked DevMind conversation
  activeRepositoryId: string | null; // currently selected repo
  preferredModel?: string | null; // per-user model override
  lastSeen: Date;                // updated on every message
  createdAt: Date;
  updatedAt: Date;
}
```

### 9. Streaming Architecture
```
Client POST /api/chat/stream
  → API creates/verifies conversation in DB
  → API saves user message to DB
  → API creates placeholder assistant message (status: 'sending')
  → API calls aiService.streamChat()
  → API streams SSE events back:
      data: {"type":"meta","conversationId":"...","assistantMessageId":"..."}
      data: {"type":"chunk","text":"Hello"}
      data: {"type":"chunk","text":" world"}
      data: {"type":"done"}
  → After stream ends: API updates assistant message content in DB
Client reads stream:
  → meta  → upsertConversation (if new), add streaming placeholder
  → chunk → appendToMessage() (live text update in Zustand)
  → done  → mark isStreaming:false, reload conversation list from API
```

### 10. Long Conversation Context Management (Sliding Window)
To prevent exceeding the model's context window limit as a conversation grows, a sliding window context strategy is applied:
- **Full History Persisted**: The complete conversation history remains fully stored in MongoDB (`messages` collection) without truncation or deletion.
- **Context Limit**: Only the most recent `MAX_CONTEXT_MESSAGES` (configured via `.env.local` or defaulting to 20) are sent to the AI provider.
- **System Prompt**: The system prompt is always appended separately as instruction headers, ensuring it is never lost regardless of window truncation.
- **Extensible Architecture**: The helper `truncateConversationContext` in `src/server/ai/aiService.ts` serves as the entry-point. It is designed to easily swap in token-based estimation, LLM summarization, or semantic memory (RAG) retrievals in the future.

### 14. RAG Backend Architecture (Phase 9)

```
User uploads document
    │
    ▼
uploadService.processUpload() → fire-and-forget processDocument(docId)
    │
    ├── Extract text (parser registry)
    ├── Persist extracted text to storage/extracted/<kbId>/<docId>.txt
    ├── Chunk text (CharacterChunkingStrategy: 800 chars / 100 overlap)
    ├── Generate batched embeddings (POST EMBEDDING_SERVICE_URL/embed, batch=32)
    └── vectorStoreProvider.saveChunks() → MongoDB documentchunks

Retrieval query:
    │
    ▼
retrievalService.retrieve(query, { knowledgeBaseId?, limit? })
    │
    ├── getEmbedding(query) → 384-dim vector
    └── vectorStoreProvider.similaritySearch(vector, options)
            │
            ▼
        MongoDB $vectorSearch (Atlas Vector Search index: "vector_index")
            │
            ▼
        Returns VectorStoreChunk[] with score: number
```

**Key abstractions:**

| File | Purpose |
|---|---|
| `embeddingService.ts` | HTTP client to SentenceTransformers service. Reads `EMBEDDING_SERVICE_URL`. Batches of 32. |
| `storage/vectorStoreProvider.ts` | Abstract `VectorStoreProvider` interface (database-agnostic) |
| `storage/mongoVectorStoreProvider.ts` | MongoDB Atlas `$vectorSearch` implementation. Falls back gracefully on local MongoDB. |
| `storage/vectorStore.ts` | Active vector store singleton — swap provider in one line |
| `retrievalService.ts` | Pure retrieval: embed query → similarity search → return scored chunks |
| `documentProcessor.ts` | Now extended with `reindexDocument(docId)` for re-chunking/re-embedding |

**AI Tools (createKnowledgeTools):**
All tools call existing service functions — no duplicate logic.

| Tool | Underlying Service |
|---|---|
| `listKnowledgeBases` | `knowledgeBaseService.listKnowledgeBases()` |
| `createKnowledgeBase` | `knowledgeBaseService.createKnowledgeBase()` |
| `renameKnowledgeBase` | `knowledgeBaseService.renameKnowledgeBase()` |
| `deleteKnowledgeBase` | `knowledgeBaseService.deleteKnowledgeBase()` |
| `listDocuments` | `kbDocumentService.listDocuments()` |
| `deleteDocument` | `kbDocumentService.deleteDocument()` |

Tools resolve knowledge base and document **names** to IDs via case-insensitive regex lookup — the AI never needs to know internal MongoDB ObjectIds.

**Atlas Vector Search Index** — must be created manually in MongoDB Atlas UI:
```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 384, "similarity": "dotProduct" },
    { "type": "filter", "path": "knowledgeBaseId" }
  ]
}
```
Index name: `vector_index` (configurable via `MONGODB_VECTOR_INDEX` env var).

**`reindexDocument(docId)`** — Reads saved `extractedTextPath`, re-chunks, re-embeds, deletes old vectors and inserts new ones. Enables reprocessing when chunking strategy or embedding model changes.

---

## Folder Structure

```
src/
├── app/
│   ├── (auth)/login/page.tsx            # /login — Login page
│   ├── (workspace)/workspace/page.tsx   # /workspace — Workspace page
│   ├── api/
│   │   ├── chat/stream/route.ts         # POST — SSE streaming AI chat
│   │   ├── conversations/
│   │   │   ├── route.ts                 # GET  — list all conversations
│   │   │   └── [id]/
│   │   │       ├── route.ts             # GET/PATCH/DELETE — single conversation
│   │   │       └── messages/route.ts    # GET — messages for a conversation
│   │   ├── knowledge/
│   │   │   ├── route.ts                 # GET  — list all KBs | POST — create KB
│   │   │   └── [id]/
│   │   │       ├── route.ts             # GET  — get KB | DELETE — delete KB
│   │   │       └── documents/
│   │   │           ├── route.ts         # GET  — list docs | POST — upload doc
│   │   │           └── [docId]/
│   │   │               └── route.ts     # GET  — get doc metadata | DELETE — delete doc
│   │   └── repos/
│   │       ├── route.ts                 # GET  — list repos | POST — connect repo
│   │       └── [id]/
│   │           ├── route.ts             # DELETE — disconnect repo
│   │           ├── files/route.ts       # GET ?path=  or ?search=  — list/search files
│   │           └── file-content/route.ts# GET ?path= — read raw file content
│   ├── layout.tsx                       # Root layout
│   ├── page.tsx                         # Root redirect (server component)
│   └── globals.css                      # Tailwind v4 @theme + design system
│
├── server/                              # Server-only code (never imported by client)
│   ├── ai/
│   │   ├── types.ts                     # AIMessage, AIProvider, AIProviderConfig interfaces
│   │   ├── aiService.ts                 # streamChat() — single AI entry-point
│   │   └── providers/
│   │       └── openrouter.ts            # OpenRouter provider (add more providers here)
│   ├── db/
│   │   ├── mongoose.ts                  # Connection singleton with global cache
│   │   ├── conversationService.ts       # All conversation DB operations
│   │   ├── messageService.ts            # All message DB operations
│   │   └── models/
│   │       ├── Conversation.ts          # Mongoose schema — metadata only
│   │       ├── Message.ts               # Mongoose schema — separate collection
│   │       ├── ConnectedRepository.ts   # Mongoose schema — connected repos
│   │       ├── WhatsappSession.ts       # Mongoose schema — per-phone WhatsApp sessions
│   │       └── index.ts                 # Barrel export
│   ├── chat/
│   │   ├── chatOrchestrator.ts          # startChatTurn() — shared AI turn logic for all clients
│   │   └── types.ts                     # ChatSessionContext, StartChatTurnResult, ClientType
│   ├── context/
│   │   ├── types.ts                     # ContextQueryResult, GraphCapabilities, GraphStatusResult
│   │   ├── graphClient.ts               # McpGraphClient — wraps @modelcontextprotocol/sdk
│   │   ├── graphService.ts              # Domain methods: explainArchitecture, findRelevantFiles, etc.
│   │   ├── contextService.ts            # ContextService singleton — LocalProvider routing + fallback
│   │   └── verify-graph.ts             # Dev verification script: connect → listTools → getGraphStatus
│   ├── repos/
│       ├── types.ts                     # RepoFile, RepositoryMetadata, RepositoryProvider interface
│       ├── repositoryService.ts         # connectRepository, listDirectory, readFile, searchFiles
│       ├── repositoryTools.ts           # Thin tool wrappers — for future AI agent use
│       └── providers/
│           ├── github.ts                # GitHubProvider — GitHub REST API
│           └── local.ts                 # LocalProvider — local filesystem (Node.js fs)
│   ├── whatsapp/
│       ├── client.ts                    # getWhatsappClient() singleton + initializeWhatsapp()
│       ├── startup.ts                   # initWhatsapp() — error-resilient boot wrapper
│       ├── messageHandler.ts            # handleIncomingMessage() — allowlist, lock queue, AI turn
│       ├── commandHandler.ts            # /repos, /repo, /current, /help slash commands
│       ├── sessionService.ts            # getOrCreateSession, updateSessionConversation, updateSessionRepository
│       ├── formatting.ts                # formatForWhatsApp(), chunkMessage()
│       └── types.ts                     # WhatsApp-specific types
│   └── knowledge/
│       ├── types.ts                     # DTOs, file types, constants
│       ├── knowledgeBaseService.ts       # CRUD for KnowledgeBases
│       ├── kbDocumentService.ts          # CRUD for Documents
│       ├── documentProcessor.ts          # Text extraction + chunking orchestration
│       ├── uploadService.ts             # Source-agnostic upload pipeline
│       ├── chunking/
│       │   ├── types.ts                 # ChunkingStrategy interfaces
│       │   ├── characterStrategy.ts     # Character chunker (800 char / 100 overlap)
│       │   └── chunkingService.ts       # Facade for strategy resolution
│       ├── parsers/
│       │   ├── types.ts                 # DocumentParser interface
│       │   ├── pdfParser.ts             # pdf-parse text extraction
│       │   ├── docxParser.ts            # mammoth text extraction
│       │   ├── textParser.ts            # native file reader for txt/md
│       │   └── parserRegistry.ts        # Map of fileType → parser
│       └── storage/
│           ├── storageProvider.ts       # Storage abstraction interface
│           ├── localStorageProvider.ts  # Node.js fs-based storage implementation
│           └── index.ts                 # Storage singleton export
│
├── instrumentation.ts                   # Next.js register() hook — starts WhatsApp on server boot
│
├── components/
│   ├── ui/                              # shadcn/ui — DO NOT hand-edit
│   ├── layout/
│   │   ├── WorkspaceShell.tsx           # 3-panel layout + auth + conversation + repo init
│   │   ├── Sidebar.tsx                  # Left panel: API-backed delete, lazy message load
│   │   ├── RepositoryPanel.tsx          # Right panel: live file tree, search, preview, connect
│   │   ├── ConnectRepoModal.tsx         # Dialog: connect GitHub or local repo
│   │   └── TopBar.tsx                   # Header: sidebar toggle, model, theme, repo toggle
│   ├── chat/
│   │   ├── ChatInterface.tsx            # Real SSE streaming — no mock logic
│   │   ├── MessageList.tsx              # Scrollable message feed with auto-scroll
│   │   ├── MessageBubble.tsx            # User + assistant message variants
│   │   ├── ChatInput.tsx                # Auto-resize textarea + send button
│   │   └── EmptyState.tsx               # Suggested prompts grid
│   ├── knowledge/
│   │   ├── KnowledgePanel.tsx           # Top-level workspace panel shell
│   │   ├── KbListView.tsx               # Grid/list of all KBs
│   │   ├── KbDetailView.tsx             # Detail dashboard (documents, progress, uploads)
│   │   ├── UploadDropzone.tsx           # Drag and drop + file picker uploader
│   │   └── DocumentStatusBadge.tsx      # Lifecycle badge (pending, processing, ready, error)
│   ├── auth/
│   │   └── LoginCard.tsx                # Login card with mock GitHub button
│   └── shared/
│       ├── Logo.tsx                     # Animated DevMind AI logo
│       ├── ThemeToggle.tsx              # Dark/light toggle
│       ├── UserAvatar.tsx               # Avatar + logout dropdown
│       └── AnimatedBackground.tsx       # Canvas mesh gradient (login page)
│
├── store/
│   ├── index.ts                         # Root store (conversations + repos NOT persisted)
│   ├── slices/                          # authSlice, uiSlice, chatSlice, repoSlice
│   └── hooks/                           # useAuth, useUI, useChat, useRepo
│
├── hooks/
│   └── useKeyboardShortcuts.ts         # ⌘B (sidebar), ⌘R (panel), ⌘K (cmd palette)
│
├── lib/
│   ├── auth.ts                          # Mock login/logout helpers ← REPLACE with real OAuth
│   ├── constants.ts                     # ROUTES, STORAGE_KEYS, COOKIE_KEYS, UI_DEFAULTS
│   └── utils.ts                         # cn(), formatDate(), truncate(), generateId()
│
├── types/
│   ├── user.ts                          # MockUser, UserRole, AuthState, UserPreferences
│   ├── chat.ts                          # Message, Conversation, MessageRole
│   ├── ui.ts                            # UIState, Theme, PanelSize
│   └── index.ts                         # Barrel re-export
│
└── middleware.ts                        # Route guard (reads devmind_session cookie)
```

---

## TypeScript Models

### `MockUser` (types/user.ts)
```typescript
interface MockUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: 'developer' | 'admin';
  githubUsername: string | null;
  createdAt: string;
  preferences: UserPreferences;
}
```

### `Message` (types/chat.ts) — Zustand client shape
```typescript
interface Message {
  id: string;                           // MongoDB ObjectId string
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  isStreaming?: boolean;                 // true while streaming
  status?: 'sending' | 'sent' | 'error';
  metadata?: Record<string, unknown>;
}
```

### `Conversation` (types/chat.ts) — Zustand client shape
```typescript
interface Conversation {
  id: string;                           // MongoDB ObjectId string
  title: string;
  messages: Message[];                  // lazy-loaded on selection
  createdAt: string;
  updatedAt: string;
  model?: string;                       // aiModel from DB
  tags?: string[];
  isPinned?: boolean;
}
```

### `IConversation` (server/db/models/Conversation.ts) — Mongoose schema
```typescript
{
  title: string;
  aiModel: string;           // 'openai/gpt-4o-mini' etc.
  metadata: Record<string, unknown>;  // extensible: repo, RAG, MCP, agent
  createdAt: Date;           // auto-managed by timestamps: true
  updatedAt: Date;           // auto-managed by timestamps: true
}
```
> Note: Field is `aiModel` (not `model`) to avoid conflict with Mongoose Document's `model()` method.

### `IMessage` (server/db/models/Message.ts) — Mongoose schema
```typescript
{
  conversationId: ObjectId;  // ref: 'Conversation'
  role: 'user' | 'assistant' | 'system';
  content: string;
  type: 'text' | 'tool_call' | 'tool_result' | 'image' | 'code';  // extensible
  status: 'sending' | 'sent' | 'error';
  metadata: Record<string, unknown>;  // RAG citations, tool args, token usage, etc.
  createdAt: Date;           // auto-managed, no updatedAt (messages are immutable)
}
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/chat/stream` | Stream AI response (SSE). Body: `{ conversationId?, message, model? }` |
| `GET` | `/api/conversations` | List all conversations (summary, no messages) |
| `GET` | `/api/conversations/[id]` | Get single conversation metadata |
| `PATCH` | `/api/conversations/[id]` | Rename conversation. Body: `{ title }` |
| `DELETE` | `/api/conversations/[id]` | Delete conversation + all its messages |
| `GET` | `/api/conversations/[id]/messages` | Get all messages for a conversation |
| `GET` | `/api/repos` | List all connected repositories |
| `POST` | `/api/repos` | Connect a repository. Body: `{ type: 'github'\|'local', config }` |
| `DELETE` | `/api/repos/[id]` | Disconnect a repository |
| `GET` | `/api/repos/[id]/files` | List directory. `?path=src/` or `?search=query` for search |
| `GET` | `/api/repos/[id]/file-content` | Read raw file content. `?path=src/index.ts` |

---

## Environment Variables

```bash
# .env.local (never commit — covered by .gitignore)

# AI Provider
OPENROUTER_API_KEY=sk-or-v1-...           # Required — get from openrouter.ai/keys
DEFAULT_AI_MODEL=openai/gpt-4o-mini       # Default model — any OpenRouter model string
ACTIVE_AI_PROVIDER=openrouter             # Optional — 'openrouter' (default), future: 'openai' | 'anthropic'

# Database
MONGODB_URI=mongodb://localhost:27017/devmind  # or Atlas connection string

# Repository
GITHUB_TOKEN=ghp_...                      # Optional — GitHub PAT for higher API rate limits
                                           # Also checked as GITHUB_PERSONAL_ACCESS_TOKEN

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Used in OpenRouter request headers
```

`.env.example` is committed as a safe template. Copy it to `.env.local` and fill in real values.

---

## How to Add a New AI Provider

1. Create `src/server/ai/providers/<name>.ts` implementing `AIProvider`:
   ```typescript
   export function createMyProvider(config: AIProviderConfig): AIProvider {
     return {
       async stream(messages, model): Promise<ReadableStream<string>> { ... }
     };
   }
   ```
2. Add a `case '<name>':` in the `createProvider()` switch in `src/server/ai/aiService.ts`
3. Set `ACTIVE_AI_PROVIDER=<name>` in `.env.local`
4. No other files need to change

---

## How to Switch the Default Model

Set `DEFAULT_AI_MODEL` in `.env.local`. Any model available on OpenRouter works:
```
DEFAULT_AI_MODEL=anthropic/claude-3-5-sonnet    # strong reasoning
DEFAULT_AI_MODEL=google/gemini-flash-1.5        # fast + cheap
DEFAULT_AI_MODEL=openai/gpt-4o                  # most capable GPT
DEFAULT_AI_MODEL=openai/gpt-4o-mini             # default (cheap + fast)
```

---

## Chat Persistence Flow

```
User sends message
  1. Frontend → POST /api/chat/stream { conversationId, message }
  2. API: create conversation in DB if conversationId is null
  3. API: save user message to DB (messages collection)
  4. API: create placeholder assistant message (status: 'sending')
  5. API: load full message history → pass to aiService.streamChat()
  6. API: stream SSE back to client
  7. After stream ends: API updates assistant message content + status in DB

User loads existing conversation
  1. WorkspaceShell mounts → GET /api/conversations → setConversations()
  2. User clicks conversation in sidebar → GET /api/conversations/[id]/messages
  3. Messages patched into Zustand with real server IDs (messages preserved)

User deletes conversation
  1. Sidebar → DELETE /api/conversations/[id]
  2. API: deleteMessagesByConversation() then deleteConversation()
  3. Frontend: optimistic local delete from Zustand
```

---

## Design System Tokens (globals.css)

| Token | Dark Value | Purpose |
|---|---|---|
| `--color-bg-base` | `#08080f` | Page background |
| `--color-bg-surface` | `#0f0f1a` | Sidebar, topbar |
| `--color-bg-elevated` | `#161626` | Cards, inputs |
| `--color-accent` | `#6366f1` | Primary brand color |
| `--color-accent-hover` | `#8b5cf6` | Hover state |
| `--color-text-primary` | `#f0f0fc` | Primary text |
| `--color-text-muted` | `#606078` | Secondary/hint text |

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `⌘B` / `Ctrl+B` | Toggle left sidebar |
| `⌘R` / `Ctrl+R` | Toggle right repo panel |
| `⌘K` / `Ctrl+K` | Open command palette (future) |
| `Enter` | Send chat message |
| `Shift+Enter` | New line in chat input |

---

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

## Development Notes

1. **`src/server/` is server-only** — never import anything from it in client components. Mongoose and the AI SDK run on Node.js only.

2. **`aiModel` not `model` in Mongoose schema** — Mongoose `Document` has a built-in `model()` method; using `model` as a field name causes a TypeScript conflict. The schema uses `aiModel`.

3. **Zustand conversations and repos are NOT persisted to localStorage**. On refresh, both reload from MongoDB. Only UI preferences are persisted.

4. **SSE stream sends a `meta` event first** — contains the real `conversationId` and `assistantMessageId` from the server. The client uses these to wire up the streaming bubble to the correct conversation.

5. **New conversation flow**: If the user sends the first message with no active conversation, the server creates it and returns the real ID via the `meta` event. The client calls `upsertConversation()` to add a stub entry to Zustand, then reloads the full list from the API after the stream completes.

6. **Auth uses BOTH localStorage AND cookies**: localStorage holds full `MockUser` for client-side. The `devmind_session` cookie is for middleware. Both cleared on logout.

7. **Vercel AI SDK**: only `streamText` from the `ai` package is used (server-side). The client-side `useChat` hook is intentionally NOT used — Zustand owns all state.

8. **shadcn/ui files are in `src/components/ui/`** — never hand-edit. Re-run `npx shadcn@latest add [component]` to update.

9. **View Transitions**: `experimental.viewTransition: true` in `next.config.ts`. Do NOT use Framer Motion `AnimatePresence` for page-level transitions.

10. **Repository provider pattern**: `RepositoryProvider` interface in `src/server/repos/types.ts` defines `getMetadata`, `listDirectory`, `readFile`, `searchFiles`. Add new providers (e.g., GitLab, Bitbucket) by implementing the interface and adding a `case` in `getProvider()` in `repositoryService.ts`.

11. **`lucide-react` in this project does NOT export `Github`** — use `GitFork` or `GitBranch` instead.

13. **Graphify context tools are registered dynamically**: `createContextTools()` discovers tools from the live MCP server each request. If the server is offline, it returns `{}` silently — no errors surface to the user.

14. **Graphify is LocalProvider-only**: `contextService.supportsGraphify()` returns `false` for GitHub repos. The AI tool list will never include graph tools for a GitHub-backed repository.

15. **To run Graphify MCP server**: Activate the `.venv` first, then `python -m graphify.serve graphify-out/graph.json --transport http --port 5001`. The graph must already be built (`graphify .`) before the server can serve it. The venv is required because Graphify is installed in `.venv`, not globally.

16. **Verifying the context layer**: Run `npx tsx --env-file=.env.local src/server/context/verify-graph.ts` to test connection, tool discovery, and fallback behaviour.

17. **WhatsApp client is a singleton**: `getWhatsappClient()` stores the `whatsapp-web.js` `Client` in `global._whatsappCache`. In Next.js dev mode with hot-reload, this prevents duplicate Puppeteer instances from spawning.

18. **WhatsApp is server-only**: `whatsapp-web.js` is listed in `next.config.ts` → `serverExternalPackages`. It must never be imported in client components. All WhatsApp logic lives under `src/server/whatsapp/`.

19. **WhatsApp startup is non-blocking**: `instrumentation.ts` calls `initWhatsapp()` with `.catch()` — a WhatsApp authentication failure (e.g., no Chrome installed) is logged but never crashes the Next.js app.

20. **Per-number message queue**: `acquireLock(phoneNumber)` in `messageHandler.ts` chains promises per phone number. Rapid sequential messages from the same number will always be processed in order without state races.

21. **ChatOrchestrator is the single AI entry-point for all clients**: The Web SSE route and the WhatsApp message handler both call `startChatTurn()`. Any new client (Telegram, Slack, CLI) should do the same — do NOT call `streamChat()` directly from client handlers.

12. **Repository files are fetched lazily**: root is loaded on `setActiveRepoId()`. Sub-folders load on `toggleFolderExpanded()`. Results are cached in `filesCache` for the session.


Graphify (Version 1)

- Graphify is an optional semantic context provider.
- DevMind does not build repository graphs.
- DevMind does not start or stop the Graphify MCP server.
- Users are responsible for indexing repositories using the official Graphify CLI.
- Users are responsible for starting the Graphify MCP server.
- If Graphify is unavailable, DevMind falls back to RepositoryService.







---

## Project Setup (from scratch)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in OPENROUTER_API_KEY, MONGODB_URI, and WHATSAPP_ALLOWED_NUMBERS

# 3. Start dev server
npm run dev
# WhatsApp will auto-initialize via instrumentation.ts
# Check terminal for QR code on first run — scan with WhatsApp mobile app

# 4. Open workspace
# Navigate to http://localhost:3000
# Login with any name (mock auth)
# Start chatting — responses come from OpenRouter

# 5. (Optional) Start Graphify MCP server for semantic codebase context
.venv\Scripts\Activate.ps1   # Windows
python -m graphify.serve graphify-out/graph.json --transport http --port 5001
```

---

## Quick Start for New AI Sessions

```bash
# 1. Read this file fully first

# 2. Check recent git history
git log --oneline -10

# 3. Find all TODOs
grep -r "TODO\|FIXME\|HACK" src/ --include="*.ts" --include="*.tsx"

# 4. Start dev server
npm run dev

# 5. Build check
npm run build
```

**Design accent color**: `#6366f1` (indigo) → `#8b5cf6` (violet) gradient

---

*Last Updated: 2026-07-11 | Phase: 7 — WhatsApp Integration*

---

## Environment Variables (updated)

```bash
# .env.local (never commit — covered by .gitignore)

# AI Provider
OPENROUTER_API_KEY=sk-or-v1-...           # Required
DEFAULT_AI_MODEL=openai/gpt-4o-mini       # Default model
ACTIVE_AI_PROVIDER=openrouter             # 'openrouter' (default)
MAX_CONTEXT_MESSAGES=20                   # Sliding window limit

# Database
MONGODB_URI=mongodb://localhost:27017/devmind

# Repository
GITHUB_TOKEN=ghp_...                      # Optional — GitHub PAT for higher rate limits

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Graphify MCP (Phase 6 — optional, enables semantic context for local repos)
# If not set, defaults to http://localhost:5001/sse
# Graphify must be installed separately: pip install "graphifyy[mcp]"
# Build graph first: graphify .
# Activate venv first, then: python -m graphify.serve graphify-out/graph.json --transport http --port 5001
GRAPHIFY_MCP_URL=http://localhost:5001/sse

# WhatsApp (Phase 7 — required for WhatsApp integration)
# Comma-separated phone numbers allowed to chat with DevMind via WhatsApp (digits only, no +)
# Example: 12025551234,447911123456
# If empty or unset, ALL incoming WhatsApp messages will be silently dropped
WHATSAPP_ALLOWED_NUMBERS=

# Maximum WhatsApp message length before chunking (default: 3500)
# WhatsApp has a ~4096 char limit per message
WHATSAPP_MAX_MESSAGE_LENGTH=3500
```
