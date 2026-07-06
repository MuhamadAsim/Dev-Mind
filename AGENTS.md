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
| **Vision** | AI coding assistant (ChatGPT + Cursor + Claude) for a single developer. Currently a fully functional AI chat application with persistent conversation history. |
| **Phase** | Phase 5 — AI ↔ Repository Integration (Foundation) |
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

### 8. Database Architecture (Phase 2 + 4)
Three separate MongoDB collections:

| Collection | Purpose |
|---|---|
| `conversations` | Conversation metadata only (title, aiModel, timestamps, metadata) |
| `messages` | All messages with `conversationId` foreign key |
| `connectedrepositories` | Connected GitHub/local repos with provider config + cached metadata |

**Why separate collections (not embedded)?**
- Efficient pagination for large conversations
- Independent indexing on `role`, `type`, `createdAt`
- Granular message updates without rewriting the whole document
- Ready for future tool-call results, RAG citations, MCP outputs
- Scales to thousands of messages per conversation

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
│   │       └── index.ts                 # Barrel export
│   └── repos/
│       ├── types.ts                     # RepoFile, RepositoryMetadata, RepositoryProvider interface
│       ├── repositoryService.ts         # connectRepository, listDirectory, readFile, searchFiles
│       ├── repositoryTools.ts           # Thin tool wrappers — for future AI agent use
│       └── providers/
│           ├── github.ts                # GitHubProvider — GitHub REST API
│           └── local.ts                 # LocalProvider — local filesystem (Node.js fs)
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

---

## Planned Features (Remaining)

- [ ] GitHub OAuth
- [ ] Markdown rendering with code syntax highlighting (react-markdown + shiki)
- [ ] Command palette (⌘K) — quick nav, search, actions
- [ ] Model selector in TopBar (functional, not UI-only)
- [ ] LangGraph agent integration
- [ ] RAG — file parsing, chunking, embeddings, vector DB, semantic search
- [ ] MCP (Model Context Protocol) — filesystem, GitHub, terminal, browser
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

12. **Repository files are fetched lazily**: root is loaded on `setActiveRepoId()`. Sub-folders load on `toggleFolderExpanded()`. Results are cached in `filesCache` for the session.

---

## Project Setup (from scratch)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in OPENROUTER_API_KEY and MONGODB_URI

# 3. Start dev server
npm run dev

# 4. Open workspace
# Navigate to http://localhost:3000
# Login with any name (mock auth)
# Start chatting — responses come from OpenRouter
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

*Last Updated: 2026-07-06 | Phase: 5 — AI ↔ Repository Integration (Foundation)*
