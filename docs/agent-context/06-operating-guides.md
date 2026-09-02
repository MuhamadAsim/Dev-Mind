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

