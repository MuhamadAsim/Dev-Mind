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



22. **KB document content is never read via repository tools**: `getDocumentContent` (in `kbDocumentService.ts`) is the only way the AI reads a Knowledge Base document's text — it calls `storageProvider.readText()` directly. `readFile` (repository tool) must never be used for `storage/uploads/` or `storage/extracted/` paths; those are internal to the knowledge module, not repo-relative paths, and using `readFile` for them only worked before by filesystem coincidence when a local repo happened to share the same disk root. Fixed 2026-07-12.

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

*Last Updated: 2026-07-12 | Phase: 10 — Context Orchestration Layer*
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

### 15. Context Orchestration Architecture (Phase 10)

Introduces a three-component orchestration layer that decouples context gathering from the AI Service. The AI Service now has a single responsibility: receive a user message + assembled context, then call the LLM.

```
User Message
    │
    ▼
Chat Orchestrator
    │
    ├── routeContext(input)       → ProviderName[]
    │       Signals (priority order):
    │       1. Session state  (activeRepositoryId → repo; conversationId → conversation)
    │       2. Structural intent patterns (code, document-seeking, conversation reference)
    │       3. Existence check (KBs in DB + information-seeking query → knowledge)
    │
    ├── buildContext(providers, input)  → AssembledContext
    │       Fan-out via Promise.allSettled — failures never block other providers
    │       Conversation entries → AIMessage[] (proper LLM turn format)
    │       Repo + Knowledge entries → systemContextBlock (prepended to system prompt)
    │
    ▼
AI Service
    messages[]   = conversationMessages + current user message
    instructions = systemContextBlock + base SYSTEM_PROMPT
```

**Module: `src/server/orchestration/`**

| File | Purpose |
|---|---|
| `types.ts` | `ProviderName`, `ContextEntry`, `ProviderResult`, `AssembledContext`, `RouterInput`, `IContextProvider` |
| `contextRouter.ts` | `routeContext()` — deterministic routing via session state + intent patterns |
| `contextBuilder.ts` | `buildContext()` — fan-out executor + formatter. Contains `PROVIDER_REGISTRY` |
| `providers/conversationProvider.ts` | Fetches message history, applies sliding window, returns `ContextEntry[]` |
| `providers/repositoryProvider.ts` | Calls `graphService.findRelevantFiles(userMessage)` — query-scoped, not broad |
| `providers/knowledgeProvider.ts` | Calls `retrieve()` from `retrievalService`, filters by `MIN_RELEVANCE_SCORE=0.3` |

**Key design rules:**
- Providers are stateless and independent — they must not know about each other
- Providers return structured `ProviderResult { entries: ContextEntry[] }` — never formatted strings
- The Context Builder is the sole formatter
- To add a new provider: implement `IContextProvider`, add one line to `PROVIDER_REGISTRY` in `contextBuilder.ts`
- Individual provider failures are logged; other providers continue unaffected
- `tools.ts`, Graphify, `retrievalService`, and WhatsApp modules are unchanged
- `truncateConversationContext` remains in `aiService.ts` as a pure utility (no DB access); Conversation Provider imports it

**`IContextProvider` interface:**
```typescript
interface IContextProvider {
  readonly name: ProviderName;
  provide(input: RouterInput): Promise<ProviderResult | null>;
}
```

**`AssembledContext` shape (received by AI Service):**
```typescript
interface AssembledContext {
  providers: ProviderName[];         // which providers contributed
  conversationMessages: AIMessage[]; // passed as messages[] to streamText
  systemContextBlock: string;        // prepended to system prompt
  hasContext: boolean;
}
```

**Future extensibility examples:** Gmail, Calendar, Google Drive, Memory, Web Search — each requires only a new provider class + one registry entry.
