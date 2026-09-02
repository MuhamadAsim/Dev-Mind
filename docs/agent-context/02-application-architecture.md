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

### 8. Voice & Text-to-Speech (TTS) Architecture
```
ChatOrchestrator (Turn Result) → VoiceService → Response Mode Router → UpliftVoiceProvider → WhatsApp MessageMedia Voice Note
```
- **`src/server/voice/voiceService.ts`**: High-level synthesis coordinator with automatic error fallback to text.
- **`src/server/voice/responseMode.ts`**: Pure intent resolver determining delivery mode (`text`, `voice`, `both`).
- **`src/server/voice/textSanitizer.ts`**: Pre-TTS Markdown/code cleaner and sentence-boundary truncator.
- **`src/server/voice/providers/uplift.ts`**: Uplift AI REST integration with timeout protection and secure logging.


