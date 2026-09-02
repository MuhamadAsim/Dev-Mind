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
| `listDocuments` | `kbDocumentService.listDocuments()` (storagePath/extractedTextPath stripped before returning to LLM) |
| `deleteDocument` | `kbDocumentService.deleteDocument()` |
| `getDocumentContent` | `kbDocumentService.getDocumentContent()` — reads extracted text via `storageProvider.readText()`. **Does not require an active repository.** |

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

