## Project Identity

| Field | Value |
|---|---|
| **Name** | DevMind AI |
| **Type** | Personal AI Software Engineering Workspace |
| **Vision** | AI coding assistant (ChatGPT + Cursor + Claude) for a single developer. Fully functional AI chat application with persistent conversation history and WhatsApp messaging integration. |
| **Phase** | Phase 10 — Context Orchestration Layer |
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

