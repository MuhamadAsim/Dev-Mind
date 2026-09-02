# DevMind AI 🧠

> **DevMind AI** is a personal AI software engineering workspace and assistant built with Next.js, Vercel AI SDK, MongoDB, SentenceTransformers, Graphify MCP, and WhatsApp integration.

---

## 🌟 Key Features

- **⚡ Full-featured AI Chat**: Streaming SSE responses powered by OpenRouter (OpenAI, Anthropic, Google Gemini models) with dynamic model switching and sliding-window context management.
- **📁 Connected Code Repositories**: Inspect, browse, search, and give the AI direct context over local file system projects and GitHub repositories.
- **📚 Knowledge Base & RAG**: Upload documents (PDF, DOCX, TXT, MD), automatic chunking and embedding generation using local SentenceTransformers (`BAAI/bge-small-en-v1.5`), and vector similarity search via MongoDB Atlas Vector Search.
- **🕸️ Graphify MCP Context**: Semantic codebase context indexing and querying via Graphify Knowledge Graph MCP server for local repositories.
- **💬 WhatsApp Assistant**: Seamless two-way WhatsApp integration via `whatsapp-web.js` with QR code terminal authentication, allowlist protection, command handling (`/repos`, `/repo <name>`, `/current`, `/help`), and asynchronous message queueing.
- **🎯 Context Orchestration**: Intelligent routing across conversation history, repository file context, and knowledge base documents.

---

## 🏗️ Architecture & Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend & API** | Next.js 16 (App Router), React 19, TypeScript | Full-stack application & Server-Sent Events (SSE) |
| **Styling & UI** | Tailwind CSS v4, shadcn/ui, Lucide Icons, Framer Motion | Modern dark/light responsive interface |
| **State Management** | Zustand v5 | Fast client state with atomic selectors |
| **AI Integration** | Vercel AI SDK (`ai`), `@ai-sdk/openai`, OpenRouter | LLM streaming and dynamic tool execution |
| **Database** | MongoDB & Mongoose | Persistent storage for conversations, messages, repos, KBs, and vector chunks |
| **Embeddings (RAG)** | FastAPI, PyTorch, `sentence-transformers` | Dedicated local 384-dim embedding microservice |
| **Code Intelligence** | Graphify MCP (`@modelcontextprotocol/sdk`) | Semantic knowledge graph queries over local repositories |
| **Mobile Access** | `whatsapp-web.js`, Puppeteer, `qrcode-terminal` | WhatsApp client gateway running inside Next.js server instrumentation |

---

## 📋 Prerequisites

Before running DevMind AI, ensure you have installed:

- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher (or pnpm / yarn)
- **Python**: `3.10` or higher (for embedding service & optional Graphify MCP)
- **MongoDB**: Local MongoDB instance (e.g. `mongodb://localhost:27017`) or a MongoDB Atlas Cluster (required for Atlas Vector Search)
- **OpenRouter API Key**: Sign up and get a key at [openrouter.ai/keys](https://openrouter.ai/keys)
- **Google Chrome / Microsoft Edge**: (Optional, for WhatsApp Web Puppeteer client)

---

## 🚀 Step-by-Step Setup Guide

### 1. Clone & Install Node Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd assistant

# Install dependencies
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Open `.env.local` and set your credentials:

```ini
# AI Provider
OPENROUTER_API_KEY=sk-or-v1-your-key-here
DEFAULT_AI_MODEL=openai/gpt-4o-mini
MAX_CONTEXT_MESSAGES=20

# Database
MONGODB_URI=mongodb://localhost:27017/devmind

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# RAG & Local Embedding Service
STORAGE_ROOT=storage
EMBEDDING_SERVICE_URL=http://127.0.0.1:8001
MONGODB_VECTOR_INDEX=vector_index

# (Optional) Graphify MCP Server
GRAPHIFY_MCP_URL=http://localhost:5001/sse

# (Optional) WhatsApp Integration
# Comma-separated list of allowed phone numbers (digits only, no '+' sign)
# e.g., 12025551234,447911123456 (leave empty to disable incoming messages)
WHATSAPP_ALLOWED_NUMBERS=
WHATSAPP_MAX_MESSAGE_LENGTH=3500
```

---

### 3. Setup & Start the Local Embedding Service (RAG)

The Knowledge Base RAG system requires the local Python embedding microservice running on port `8001`.

```bash
# Navigate to the embedding service directory
cd embeddingService

# Create and activate a Python virtual environment
# Windows (PowerShell):
python -m venv .venv
.venv\Scripts\Activate.ps1

# Linux / macOS:
# python3 -m venv .venv
# source .venv/bin/activate

# Install requirements
pip install -r requirements.txt

# Start the embedding microservice
uvicorn server:app --host 127.0.0.1 --port 8001
```

> 💡 *Keep this terminal window running, or run it as a background service.*

---

### 4. (Optional) Setup Graphify MCP Server

If you wish to use semantic knowledge graph context for local repositories:

```bash
# In your main project or target repo directory (with Python venv active):
pip install "graphifyy[mcp]"

# Generate knowledge graph for the codebase
graphify .

# Serve knowledge graph via MCP HTTP/SSE transport on port 5001
python -m graphify.serve graphify-out/graph.json --transport http --port 5001
```

---

### 5. Start the DevMind Next.js Application

In the root project directory:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

#### WhatsApp First-Time Setup
If `WHATSAPP_ALLOWED_NUMBERS` is configured, when Next.js starts up:
1. A QR code will be printed directly in your terminal.
2. Open WhatsApp on your phone > **Linked Devices** > **Link a Device**.
3. Scan the terminal QR code to authenticate the session.
4. Session credentials persist in `.wwebjs_auth/` so you won't need to scan again on every restart.

---

## 🛠️ Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts Next.js in development mode with Webpack bundler |
| `npm run build` | Builds the Next.js production application |
| `npm run start` | Runs the built Next.js production server |
| `npm run lint` | Runs ESLint checks across the codebase |

---

## 📂 Project Structure

```
├── .env.example             # Example environment variables
├── AGENTS.md                # AI Assistant & developer memory rules
├── docs/                    # Detailed architecture and development documentation
│   └── agent-context/       # In-depth architectural references & guides
├── embeddingService/        # FastAPI + SentenceTransformers embedding service
│   ├── server.py            # Embedding API (POST /embed, GET /health)
│   ├── requirements.txt     # Python dependencies (FastAPI, PyTorch, sentence-transformers)
│   └── README.md            # Embedding service setup guide
├── public/                  # Static assets
├── storage/                 # Uploaded files and extracted text for Knowledge Bases
└── src/
    ├── app/                 # Next.js App Router (pages & API routes)
    │   ├── api/chat/        # Chat streaming endpoints & orchestrator
    │   ├── api/knowledge/   # Knowledge base document upload & retrieval API
    │   ├── api/repos/       # Local & GitHub repository management API
    │   └── ...              # UI route layouts & views
    ├── components/          # React components (Chat, Sidebar, Modals, etc.)
    │   └── ui/              # shadcn/ui components
    ├── hooks/               # Custom React hooks
    ├── instrumentation.ts   # Next.js server runtime hooks (WhatsApp auto-init)
    ├── lib/                 # Shared utilities and configurations
    ├── server/              # Server-only modules (Node.js runtime)
    │   ├── ai/              # AI Service, system prompts, tool definitions
    │   ├── chat/            # ChatOrchestrator session management
    │   ├── context/         # Graphify MCP client and context tools
    │   ├── db/              # MongoDB connection & Mongoose schemas
    │   ├── knowledge/       # RAG services (parsers, chunking, retrieval)
    │   ├── orchestration/   # Context Router & Context Builder
    │   ├── repos/           # GitHub & Local repository providers
    │   └── whatsapp/        # WhatsApp Web client, handlers, and formatters
    ├── store/               # Zustand state stores
    └── types/               # Shared TypeScript type definitions
```

---

## 🔐 Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENROUTER_API_KEY` | **Yes** | — | OpenRouter API Key for LLM completions |
| `DEFAULT_AI_MODEL` | No | `openai/gpt-4o-mini` | Default model identifier on OpenRouter |
| `MAX_CONTEXT_MESSAGES` | No | `20` | Sliding window message context limit |
| `MONGODB_URI` | **Yes** | `mongodb://localhost:27017/devmind` | MongoDB connection string |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Public application URL |
| `EMBEDDING_SERVICE_URL` | **Yes** (for RAG) | `http://127.0.0.1:8001` | URL to SentenceTransformers FastAPI service |
| `MONGODB_VECTOR_INDEX` | No | `vector_index` | MongoDB Atlas Vector Search Index name |
| `STORAGE_ROOT` | No | `storage` | Local directory path for KB uploads & extracted text |
| `GRAPHIFY_MCP_URL` | No | `http://localhost:5001/sse` | URL to Graphify Knowledge Graph MCP server |
| `WHATSAPP_ALLOWED_NUMBERS` | No | `""` | Comma-separated allowlist of phone numbers (digits only) |
| `WHATSAPP_MAX_MESSAGE_LENGTH`| No | `3500` | Max character length per chunk for WhatsApp replies |
| `GITHUB_TOKEN` | No | — | Optional GitHub Personal Access Token for higher rate limits |

---

## 📖 Detailed Documentation

For comprehensive internal architectural documentation, design decisions, and operating guides, see [`AGENTS.md`](./AGENTS.md) and the [`docs/agent-context/`](./docs/agent-context/) directory.
