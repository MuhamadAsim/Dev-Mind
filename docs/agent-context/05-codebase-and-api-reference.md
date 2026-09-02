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

