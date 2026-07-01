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
| **Vision** | AI coding assistant (ChatGPT + Cursor + Claude) for a single developer |
| **Phase** | Frontend MVP — UI shell only, no real AI/backend yet |
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

---

## Architecture Decisions

### 1. Route Groups
```
src/app/
├── (auth)/login/         → /login  (no shared layout, full-screen bg)
├── (workspace)/workspace/ → /workspace (3-panel shell)
├── layout.tsx             → Root layout (fonts, ThemeProvider, TooltipProvider)
└── page.tsx               → Server Component redirect (/ → /login or /workspace)
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
│   └── chatSlice.ts            ← conversations, activeConversationId, CRUD actions
└── hooks/
    ├── useAuth.ts              ← Auth selector hooks (ONLY import from here, not useStore)
    ├── useUI.ts                ← UI selector hooks
    └── useChat.ts              ← Chat selector hooks
```

**Rule**: Components **never** import `useStore` directly. Always use domain hooks.

**Persist config** (Zustand persist middleware): Only `theme`, `isSidebarOpen`, `isRepoPanelOpen`, `conversations`, `activeConversationId` are persisted.

### 4. Client/Server Component Split
- `app/**/page.tsx` → Server Components (metadata, redirects)
- `app/layout.tsx` → Server Component (fonts, providers)
- All interactive UI → `'use client'` (sidebar, chat, animations)
- **Never** access `localStorage` or `document` in Server Components

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

---

## Folder Structure

```
src/
├── app/
│   ├── (auth)/login/page.tsx            # /login — Login page
│   ├── (workspace)/workspace/page.tsx   # /workspace — Workspace page
│   ├── layout.tsx                       # Root layout
│   ├── page.tsx                         # Root redirect (server component)
│   └── globals.css                      # Tailwind v4 @theme + design system
│
├── components/
│   ├── ui/                              # shadcn/ui — DO NOT hand-edit
│   ├── layout/
│   │   ├── WorkspaceShell.tsx           # 3-panel layout + auth init + keyboard shortcuts
│   │   ├── Sidebar.tsx                  # Left panel: conversations, search, user
│   │   ├── RepositoryPanel.tsx          # Right panel: mock files, branches, PRs
│   │   └── TopBar.tsx                   # Header: sidebar toggle, model, theme, repo toggle
│   ├── chat/
│   │   ├── ChatInterface.tsx            # Chat orchestrator (mock AI response logic here)
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
│   ├── index.ts                         # Root store
│   ├── slices/                          # authSlice, uiSlice, chatSlice
│   └── hooks/                           # useAuth, useUI, useChat
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
  githubUsername: string | null; // null until real OAuth
  createdAt: string;
  preferences: UserPreferences;
}
```

### `Message` (types/chat.ts)
```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  isStreaming?: boolean; // for future streaming
  status?: 'sending' | 'sent' | 'error';
  metadata?: Record<string, unknown>;
}
```

### `Conversation` (types/chat.ts)
```typescript
interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  model?: string; // future multi-model support
  tags?: string[];
  isPinned?: boolean;
}
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

## Features Implemented (MVP)

- [x] Next.js 15 App Router project scaffold
- [x] Tailwind CSS v4 CSS-first design system
- [x] shadcn/ui integration (button, tooltip, dropdown, avatar, scroll-area, badge, separator)
- [x] Zustand store with auth/ui/chat slices + selector hooks
- [x] TypeScript types for User, Chat, UI
- [x] Mock auth: localStorage + session cookie, survives refresh
- [x] Route protection middleware (`devmind_session` cookie)
- [x] Root `/` redirect based on session
- [x] Login page with animated canvas background
- [x] Premium LoginCard with shimmer button + loading state
- [x] Dark/light theme toggle (next-themes, zero flash)
- [x] 3-panel workspace layout (TopBar + Sidebar + Chat + RepoPanel)
- [x] Left sidebar: collapsible (Framer Motion), conversation list, pin/delete, new chat, search
- [x] Right repo panel: collapsible, mock file/branch/PR placeholders
- [x] TopBar: model selector, sidebar/panel toggles, settings
- [x] Chat interface: empty state with suggestion grid
- [x] Chat input: auto-resize, keyboard shortcuts, animated send button
- [x] Message bubbles: user + assistant variants, streaming indicator, copy/feedback actions
- [x] Mock AI responses with simulated delay
- [x] Keyboard shortcuts: ⌘B, ⌘R, ⌘K
- [x] UserAvatar with dropdown (logout)
- [x] Animated Logo component
- [x] AGENTS.md project memory

---

## Planned Features (Post-MVP)

- [ ] Real GitHub OAuth (replace `src/lib/auth.ts`)
- [ ] OpenAI / Anthropic / Gemini API streaming
- [ ] Markdown rendering with code syntax highlighting (react-markdown + shiki)
- [ ] Command palette (⌘K) — quick nav, search, actions
- [ ] Multiple AI model selector (dropdown in TopBar)
- [ ] LangGraph agent integration
- [ ] RAG (Retrieval Augmented Generation)
- [ ] MCP (Model Context Protocol) tool support
- [ ] Real GitHub repository browser (GitHub API)
- [ ] Conversation memory persistence (DB)
- [ ] File attachments
- [ ] Voice input
- [ ] Mobile sidebar drawer (responsive)
- [ ] Settings page
- [ ] Export conversation as markdown

---

## Known Issues / TODOs

- [ ] `utils.ts` was partially overwritten by shadcn init — verify `cn()` export still present
- [ ] `globals.css` was appended to by shadcn — review for any conflicting variables
- [ ] Mobile layout: sidebar currently hides on collapse but no drawer fallback for mobile
- [ ] `useRenameConversation` implemented but no UI trigger yet
- [ ] Model selector in TopBar is UI-only (no actual model switching)
- [ ] Settings button has no page/modal yet

---

## Development Notes

1. **Auth uses BOTH localStorage AND cookies**: localStorage holds full `MockUser` for client-side. The `devmind_session` cookie is for middleware (server-side). Both are cleared on logout.

2. **shadcn/ui files are in `src/components/ui/`** — never hand-edit. Re-run `npx shadcn@latest add [component]` to update or add components.

3. **Tailwind v4**: No `tailwind.config.ts` theme customization. All tokens in `globals.css` `@theme {}`.

4. **Framer Motion + Next.js**: All Framer Motion components must be `'use client'`. Never use in Server Components.

5. **View Transitions**: `experimental.viewTransition: true` in `next.config.ts`. Do NOT use Framer Motion `AnimatePresence` for page-level transitions.

6. **Mock AI responses** are in `ChatInterface.tsx` → `MOCK_RESPONSES` array and `getMockResponse()`. Replace with real API streaming.

7. **Geist font variables** are `--font-geist-sans` and `--font-geist-mono` — loaded via `next/font/google` in root layout.

---

## Quick Start for New AI Sessions

```bash
# 1. Check recent git history
git log --oneline -10

# 2. Find all TODOs
grep -r "TODO\|FIXME\|HACK" src/ --include="*.ts" --include="*.tsx"

# 3. Start dev server
npm run dev

# 4. Build check
npm run build
```

**Design accent color**: `#6366f1` (indigo) → `#8b5cf6` (violet) gradient

---

*Last Updated: 2026-07-01 | Session: Frontend MVP Implementation*
