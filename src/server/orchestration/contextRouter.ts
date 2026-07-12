// ============================================================
// Context Router
//
// Determines which context providers should execute for a given
// request. Uses session state as the primary signal and structural
// intent patterns as secondary. Keywords are a fallback.
//
// Never calls the LLM. Never performs retrieval. Zero side effects.
// ============================================================
import type { RouterInput, ProviderName } from './types';
import { connectDB } from '../db/mongoose';
import { KnowledgeBaseModel } from '../db/models';

// ── Intent analysis ──────────────────────────────────────────

/**
 * Detect if the message is asking about code, files, or a repository.
 * Uses structural patterns (what is being asked about) rather than word lists.
 */
function detectRepositoryIntent(message: string): boolean {
  const patterns = [
    // Asking about code constructs
    /\b(function|method|class|interface|type|hook|component|module|service|util|helper|middleware|handler)\b/i,
    // Actions directed at code
    /\b(debug|refactor|implement|fix|review|optimize|test|lint|build)\b.{0,30}\b(code|file|function|class|component|module)\b/i,
    // File/structure exploration
    /\b(file|folder|directory|path|import|export|require|include)\b/i,
    // Error investigation patterns
    /\b(error|bug|issue|crash|fail|exception|stack\s*trace|undefined|null pointer)\b/i,
    // Architecture/code understanding
    /\bhow (does|is|are).{0,50}\b(work|implemented|structured|organized|connected)\b/i,
    // Code reading requests
    /\b(show|read|open|look at|find|locate).{0,20}\b(file|source|code|src)\b/i,
  ];
  const matched = patterns.some(p => p.test(message));
  console.log(`[contextRouter DEBUG] detectRepositoryIntent: ${matched} for message "${message}"`);
  return matched;
}

/**
 * Detect if the message is seeking information from documents or knowledge bases.
 * Looks for information-retrieval intent structures, not just document keywords.
 */
function detectKnowledgeIntent(message: string): boolean {
  const patterns = [
    // Classic RAG pattern: "what does X say about Y"
    /what does .{2,60} (say|mention|cover|explain|discuss|describe) about/i,
    // Source attribution: "according to my document/notes/pdf"
    /according to .{0,40}(document|notes|pdf|paper|study|book|report|reading|material)/i,
    // Summarisation of a document
    /\b(summarize|summary of|overview of|brief on).{0,30}(document|paper|notes|reading|chapter|section)/i,
    // Explicit document type references
    /\b(uploaded|my\s+document|my\s+notes|my\s+pdf|knowledge\s+base|KB)\b/i,
    // Retrieval / look-up patterns
    /\b(find|look up|retrieve|search for).{0,20}(information|details|data|context|facts)\b/i,
    // Compare document with something
    /compare.{0,40}(document|notes|paper).{0,40}(with|to|against)/i,
    /compare.{0,40}(with|to|against).{0,40}(document|notes|paper)/i,
  ];
  const matched = patterns.some(p => p.test(message));
  console.log(`[contextRouter DEBUG] detectKnowledgeIntent: ${matched} for message "${message}"`);
  return matched;
}

/**
 * Detect if the message explicitly references past conversation turns.
 * These are distinct structural phrases, not just any question.
 */
function detectConversationReferenceIntent(message: string): boolean {
  const patterns = [
    // Temporal references to earlier in this session
    /\b(earlier|before|previously|last time|before this|a moment ago)\b/i,
    // Direct attribution to prior exchange
    /\b(we discussed|you said|you mentioned|we talked about|we covered|you explained|you told me)\b/i,
    // Memory/recall requests
    /\b(remember|recall|remind me|what did we|what was the)\b/i,
    // Continuation markers
    /\b(follow.?up|continuing (from|on)|going back to|as (I|you) (said|mentioned)|per our (earlier|previous))\b/i,
    // Reference to a specific artifact from the session
    /\b(that (solution|approach|code|idea|suggestion|option)) (you|we) (showed|mentioned|discussed|proposed)\b/i,
  ];
  const matched = patterns.some(p => p.test(message));
  console.log(`[contextRouter DEBUG] detectConversationReferenceIntent: ${matched} for message "${message}"`);
  return matched;
}

/**
 * Detect if the message has a general information-seeking structure.
 * Used as a gate for opportunistic knowledge routing.
 */
function isInformationSeeking(message: string): boolean {
  const matched = /\b(what is|what are|explain|describe|tell me about|how does|why does|what happens|define|what do you know about)\b/i.test(message);
  console.log(`[contextRouter DEBUG] isInformationSeeking: ${matched} for message "${message}"`);
  return matched;
}

// ── Router ───────────────────────────────────────────────────

/**
 * Route the user request to the appropriate set of context providers.
 *
 * Priority order:
 *   1. Session state  — activeRepositoryId, conversationId
 *   2. Structural intent patterns — code, document, conversation reference
 *   3. Existence check (fallback) — opportunistic knowledge routing when KBs exist
 *
 * Returns an ordered array of provider names to execute.
 */
export async function routeContext(input: RouterInput): Promise<ProviderName[]> {
  const { userMessage, activeRepositoryId, conversationId } = input;
  const providers = new Set<ProviderName>();

  console.log(`\n=================== CONTEXT ROUTER START ===================`);
  console.log(`[contextRouter DEBUG] input: userMessage="${userMessage}"`);
  console.log(`[contextRouter DEBUG] input: activeRepositoryId=${activeRepositoryId}`);
  console.log(`[contextRouter DEBUG] input: conversationId=${conversationId}`);

  // ── 1. Session state (highest confidence signals) ─────────────
  
  // Conversation provider: always active when a conversation exists.
  // History is almost always useful context.
  if (conversationId) {
    console.log(`[contextRouter DEBUG] adding 'conversation' due to conversationId existence`);
    providers.add('conversation');
  }

  // Repository provider: an active repo in session is a strong signal
  // that the user is working in repository context.
  if (activeRepositoryId) {
    console.log(`[contextRouter DEBUG] adding 'repository' due to activeRepositoryId existence`);
    providers.add('repository');
  }

  // ── 2. Intent-based routing ──────────────────────────────────
  
  // Knowledge: explicit document-seeking intent detected
  if (detectKnowledgeIntent(userMessage)) {
    console.log(`[contextRouter DEBUG] adding 'knowledge' due to document/knowledge intent match`);
    providers.add('knowledge');
  }

  // Conversation references: if not already included (e.g. new conversation),
  // a strong reference intent is worth noting (provider will return null if
  // conversationId is null — graceful fallback).
  if (!providers.has('conversation') && detectConversationReferenceIntent(userMessage)) {
    console.log(`[contextRouter DEBUG] adding 'conversation' due to conversation reference intent match`);
    providers.add('conversation');
  }

  // Repository: if no active repo but message clearly targets code,
  // still register the provider — it will gracefully return null
  // since it requires activeRepositoryId.
  if (!providers.has('repository') && detectRepositoryIntent(userMessage)) {
    console.log(`[contextRouter DEBUG] adding 'repository' due to repository intent match`);
    providers.add('repository');
  }

  // ── 3. Opportunistic knowledge routing (fallback) ─────────────
  // If the intent is information-seeking and not purely code-related,
  // check whether any Knowledge Bases exist. If so, include the provider
  // — the provider's own relevance threshold will filter low-quality results.
  const repoIntentMatched = detectRepositoryIntent(userMessage);
  const infoSeekingMatched = isInformationSeeking(userMessage);
  if (!providers.has('knowledge') && infoSeekingMatched && !repoIntentMatched) {
    try {
      await connectDB();
      const kbCount = await KnowledgeBaseModel.countDocuments().lean();
      console.log(`[contextRouter DEBUG] opportunistic check: kbCount=${kbCount}`);
      if (kbCount > 0) {
        console.log(`[contextRouter DEBUG] adding 'knowledge' due to info-seeking intent & existing KBs`);
        providers.add('knowledge');
      }
    } catch (err: any) {
      // Non-fatal — skip knowledge routing if DB check fails
      console.warn('[contextRouter] DB check failed during opportunistic knowledge routing:', err?.message ?? err);
    }
  }

  const selected = [...providers];
  console.log(`[contextRouter DEBUG] Selected providers: [${selected.join(', ')}]`);
  console.log(`=================== CONTEXT ROUTER END ===================\n`);
  return selected;
}
