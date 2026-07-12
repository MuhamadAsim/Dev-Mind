// ============================================================
// Context Orchestration — Shared Types
//
// The orchestration layer decouples context gathering from the
// AI Service. Providers return structured data; the Builder is
// the sole formatter.
// ============================================================
import type { AIMessage } from '../ai/types';

// ── Provider naming ──────────────────────────────────────────
// Open union: 'conversation' | 'repository' | 'knowledge' get
// type-safety + autocomplete, but any future string also compiles.
export type ProviderName = 'conversation' | 'repository' | 'knowledge' | (string & {});

// ── Structured context unit ──────────────────────────────────
// A single piece of context returned by a provider.
// Providers NEVER format strings — they return entries.
// The Context Builder is the only place formatting happens.
export interface ContextEntry {
  /**
   * The semantic type of this entry.
   * - 'message'       — a conversation turn (user or assistant)
   * - 'chunk'         — a retrieved Knowledge Base text chunk
   * - 'graph-summary' — raw Graphify graph traversal output
   * - 'file-hint'     — a relevant repository file/symbol reference
   * Open union for future provider types.
   */
  type: 'message' | 'chunk' | 'graph-summary' | 'file-hint' | (string & {});
  /** The text content of this entry. */
  content: string;
  /** Relevance score, if available (e.g. vector similarity score from Knowledge Provider). */
  score?: number;
  /** Source identifier (filename, document name, graph node label, etc.). */
  source?: string;
  /** Provider-specific opaque metadata (e.g. role for messages, chunk index for KB chunks). */
  metadata?: Record<string, unknown>;
}

// ── Provider result ──────────────────────────────────────────
// What each provider returns. Structured data only — no formatting.
export interface ProviderResult {
  provider: ProviderName;
  entries: ContextEntry[];
  /** Provider-level metadata (e.g. repoId, graphStatus, KB IDs used). */
  metadata?: Record<string, unknown>;
}

// ── Assembled context ────────────────────────────────────────
// What the AI Service receives after the Context Builder runs.
// It never knows which providers contributed or how retrieval worked.
export interface AssembledContext {
  /** Names of providers that successfully contributed context. */
  providers: ProviderName[];
  /**
   * Conversation history as proper AIMessage objects.
   * Passed directly as the `messages[]` parameter to streamText.
   * Does NOT include the current user message (appended by AI Service).
   */
  conversationMessages: AIMessage[];
  /**
   * Formatted context block for repository and knowledge providers.
   * Prepended to the system prompt when non-empty.
   */
  systemContextBlock: string;
  /** True if at least one provider contributed usable context. */
  hasContext: boolean;
}

// ── Router input ─────────────────────────────────────────────
// The inputs available to the Context Router and each Provider.
export interface RouterInput {
  /** The current user message (already trimmed). */
  userMessage: string;
  /** The active repository ID from session state, or null. */
  activeRepositoryId: string | null;
  /** The current conversation ID, or null for a brand-new conversation. */
  conversationId: string | null;
}

// ── Provider contract ────────────────────────────────────────
// Every context provider must implement this interface.
// Providers are stateless and must not know about each other.
export interface IContextProvider {
  /** Unique, stable identifier for this provider. */
  readonly name: ProviderName;
  /**
   * Gather context for the given request.
   * Returns null if no relevant context is available.
   * MUST NOT throw — handle errors internally and return null.
   */
  provide(input: RouterInput): Promise<ProviderResult | null>;
}
