// ============================================================
// Context Builder
//
// Executes the providers selected by the Context Router in parallel,
// collects their structured results, and assembles a single
// AssembledContext for the AI Service.
//
// This is the ONLY component responsible for formatting context
// into human-readable text blocks. Providers return raw data.
//
// Provider Registry:
//   To add a new provider — implement IContextProvider and add one
//   line to PROVIDER_REGISTRY below. Nothing else changes.
// ============================================================
import type { RouterInput, ProviderName, ProviderResult, AssembledContext, IContextProvider, ContextEntry } from './types';
import type { AIMessage } from '../ai/types';
import { ConversationProvider } from './providers/conversationProvider';
import { RepositoryProvider } from './providers/repositoryProvider';
import { KnowledgeProvider } from './providers/knowledgeProvider';

// ── Provider Registry ─────────────────────────────────────────────
// Single source of truth for available providers.
// Adding a new provider: create the class, add one entry here.
const PROVIDER_REGISTRY: Map<ProviderName, IContextProvider> = new Map<ProviderName, IContextProvider>([
  ['conversation', new ConversationProvider()],
  ['repository',   new RepositoryProvider()],
  ['knowledge',    new KnowledgeProvider()],
]);

// Canonical ordering for the system context block.
// Conversation messages are extracted separately (not in this list).
const SYSTEM_BLOCK_ORDER: ProviderName[] = ['repository', 'knowledge'];

// ── Formatting ────────────────────────────────────────────────────
// All formatting logic lives here — providers never produce strings.

function formatEntry(entry: ContextEntry): string {
  const lines: string[] = [entry.content.trim()];
  if (entry.source) {
    lines.push(`[Source: ${entry.source}]`);
  }
  if (entry.score !== undefined) {
    lines.push(`[Relevance: ${(entry.score * 100).toFixed(0)}%]`);
  }
  return lines.join(' ');
}

function formatProviderBlock(result: ProviderResult): string {
  const label = result.provider.charAt(0).toUpperCase() + result.provider.slice(1);
  const body = result.entries.map(formatEntry).join('\n\n');
  return `=== ${label} Context ===\n${body}`;
}

// ── Context Builder ───────────────────────────────────────────────

/**
 * Execute the selected providers and assemble context for the AI Service.
 *
 * Guarantees:
 * - Individual provider failures are logged but never propagate.
 * - Conversation entries are returned as AIMessage[] (proper LLM format).
 * - Repository and Knowledge entries become the system context block.
 * - Future providers outside SYSTEM_BLOCK_ORDER are appended at the end.
 */
export async function buildContext(
  selectedProviders: ProviderName[],
  input: RouterInput
): Promise<AssembledContext> {
  console.log(`\n=================== CONTEXT BUILDER START ===================`);
  console.log(`[contextBuilder DEBUG] selectedProviders: [${selectedProviders.join(', ')}]`);

  if (selectedProviders.length === 0) {
    console.log(`[contextBuilder DEBUG] No providers selected. Returning empty assembled context.`);
    console.log(`=================== CONTEXT BUILDER END ===================\n`);
    return {
      providers: [],
      conversationMessages: [],
      systemContextBlock: '',
      hasContext: false,
    };
  }

  // ── Fan-out: all providers run in parallel ──────────────────
  const settled = await Promise.allSettled(
    selectedProviders.map(
      async (name): Promise<[ProviderName, ProviderResult | null]> => {
        const provider = PROVIDER_REGISTRY.get(name);
        if (!provider) {
          console.warn(`[contextBuilder DEBUG] No provider registered for name: "${name}"`);
          return [name, null];
        }
        try {
          console.log(`[contextBuilder DEBUG] Starting provider: "${name}"...`);
          const result = await provider.provide(input);
          const status = result
            ? `${result.entries.length} entries`
            : 'no context (returned null)';
          console.log(`[contextBuilder DEBUG] Finished provider "${name}": status=${status}`);
          if (result && result.entries.length > 0) {
            result.entries.forEach((ent, idx) => {
              console.log(`  - Entry #${idx} of "${name}": type=${ent.type}, source=${ent.source || 'N/A'}, content length=${ent.content.length}`);
            });
          }
          return [name, result];
        } catch (err: any) {
          // Defensive: providers should catch their own errors, but we
          // catch here too so one failing provider never breaks the chain.
          console.error(`[contextBuilder DEBUG] Provider "${name}" threw unexpectedly:`, err?.message ?? err, err.stack);
          return [name, null];
        }
      }
    )
  );

  // ── Collect successful results ──────────────────────────────
  const resultMap = new Map<ProviderName, ProviderResult>();
  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      const [name, result] = outcome.value;
      if (result && result.entries.length > 0) {
        resultMap.set(name, result);
      }
    } else {
      console.error('[contextBuilder DEBUG] Unexpected Promise rejection:', outcome.reason);
    }
  }

  // ── Extract conversation messages ───────────────────────────
  // Conversation entries stay as proper AIMessage[] so the AI Service
  // can pass them directly to streamText in the messages[] parameter.
  let conversationMessages: AIMessage[] = [];
  const convResult = resultMap.get('conversation');
  if (convResult) {
    conversationMessages = convResult.entries
      .filter(e => e.type === 'message')
      .map(e => ({
        role: (e.metadata?.role as AIMessage['role']) ?? 'user',
        content: e.content,
      }));
    console.log(`[contextBuilder DEBUG] Extracted ${conversationMessages.length} conversation messages from 'conversation' provider.`);
  }

  // ── Build system context block ──────────────────────────────
  // Repository and Knowledge (and future providers) are formatted as text.
  const systemBlocks: string[] = [];
  const contributingProviders: ProviderName[] = [];

  if (conversationMessages.length > 0) {
    contributingProviders.push('conversation');
  }

  // Apply canonical ordering for known providers
  for (const name of SYSTEM_BLOCK_ORDER) {
    const result = resultMap.get(name);
    if (result && result.entries.length > 0) {
      const formattedBlock = formatProviderBlock(result);
      console.log(`[contextBuilder DEBUG] Formatted context block for "${name}" (length=${formattedBlock.length}):\n${formattedBlock}\n`);
      systemBlocks.push(formattedBlock);
      contributingProviders.push(name);
    }
  }

  // Append any future providers not covered by SYSTEM_BLOCK_ORDER
  for (const [name, result] of resultMap.entries()) {
    if (!SYSTEM_BLOCK_ORDER.includes(name) && name !== 'conversation') {
      const formattedBlock = formatProviderBlock(result);
      console.log(`[contextBuilder DEBUG] Formatted context block for future/other provider "${name}" (length=${formattedBlock.length}):\n${formattedBlock}\n`);
      systemBlocks.push(formattedBlock);
      contributingProviders.push(name);
    }
  }

  const systemContextBlock = systemBlocks.join('\n\n');
  const hasContext = conversationMessages.length > 0 || systemContextBlock.length > 0;

  console.log(`[contextBuilder DEBUG] Final AssembledContext:`);
  console.log(`  - contributingProviders: [${contributingProviders.join(', ')}]`);
  console.log(`  - conversationMessages count: ${conversationMessages.length}`);
  console.log(`  - systemContextBlock length: ${systemContextBlock.length} chars`);
  console.log(`  - hasContext: ${hasContext}`);
  console.log(`=================== CONTEXT BUILDER END ===================\n`);

  return {
    providers: contributingProviders,
    conversationMessages,
    systemContextBlock,
    hasContext,
  };
}

// Re-export registry accessor for testing / introspection
export function getRegisteredProviders(): ProviderName[] {
  return [...PROVIDER_REGISTRY.keys()];
}
