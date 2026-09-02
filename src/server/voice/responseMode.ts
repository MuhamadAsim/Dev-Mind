// ============================================================
// Response Mode Intent Router
//
// Determines the delivery mode ('text' | 'voice' | 'both') for a turn.
// Priority:
//   1. Explicit voice + text request ("both")       -> 'both'
//   2. Explicit voice request                        -> 'voice' (overrides all)
//   3. Actions / Mutations / Uploads / Code edits     -> 'text'
//   4. Knowledge Base informational / retrieval      -> 'voice'
//   5. Default                                       -> 'text'
// ============================================================

import type { ResponseMode, ResponseModeInput } from './types';

/**
 * Detects if the user explicitly requested BOTH text and voice delivery.
 * Avoids false matches on casual words like "invoice" or "voice auth".
 */
export function detectExplicitBothIntent(message: string): boolean {
  const m = message.trim().toLowerCase();

  const patterns = [
    /\b(both\s+(text\s+and\s+voice|voice\s+and\s+text)|text\s+and\s+voice|voice\s+and\s+text|text\s+and\s+audio|audio\s+and\s+text)\b/i,
    /\b(send|give|reply|respond).{0,20}\b(both\s+(text\s+and\s+voice|voice\s+and\s+text))\b/i,
    /\b(give\s+me\s+both|send\s+both|reply\s+with\s+both)\b/i,
    /\b(voice\s+too|audio\s+too)\b/i,
    /\b(send|reply|give|answer).{0,20}\b(text\s+and\s+voice|voice\s+and\s+text)\b/i,
    /\b(as|with|in)\s+both\s+(text\s+and\s+voice|voice\s+and\s+text)\b/i,
  ];

  return patterns.some((p) => p.test(m));
}

/**
 * Detects if the user explicitly instructed the assistant to deliver the answer via voice.
 * Uses structural intent phrases to avoid false positives (e.g., "voice authentication" should NOT trigger voice mode).
 */
export function detectExplicitVoiceIntent(message: string): boolean {
  const m = message.trim().toLowerCase();

  // Guard against phrases where "voice" is a technical topic rather than a delivery instruction
  const nonDeliveryTopicPatterns = [
    /\bvoice\s+(authentication|recognition|biometrics|cloning|control|over\s+ip|command|assistant|search|changer)\b/i,
    /\b(active|passive)\s+voice\b/i,
  ];
  
  // If it's purely discussing "voice authentication" without an instruction like "send in voice", don't treat as delivery request
  const hasDeliveryInstruction =
    /\b(send|reply|give|answer|tell|explain|respond|read|speak|deliver)\b/i.test(m) ||
    /\b(in\s+voice|by\s+voice|as\s+voice|via\s+voice|with\s+voice|in\s+audio|as\s+audio|by\s+audio)\b/i.test(m);

  if (!hasDeliveryInstruction && nonDeliveryTopicPatterns.some((p) => p.test(m))) {
    return false;
  }

  const patterns = [
    // Direct delivery requests: "send this as voice", "reply with voice", "tell me this by voice"
    /\b(send|reply|give|answer|tell|explain|respond)\s+(this|it|me|the\s+answer|the\s+response)?\s*(in|as|by|with|via)\s+(a\s+)?(voice|audio|voice\s*message|voice\s*note|audio\s*message|audio\s*note)\b/i,
    // "send this as voice", "send voice message"
    /\b(send|give|leave)\s+(me\s+)?(a\s+)?(voice\s*message|voice\s*note|audio\s*message|audio\s*response|voice\s*response)\b/i,
    // "reply with voice", "reply by voice", "reply in voice"
    /\b(reply|respond)\s+(with|in|by|via)\s+(a\s+)?(voice|audio|voice\s*note|voice\s*message)\b/i,
    // "send this as voice", "reply with voice"
    /\b(send\s+this\s+as\s+voice|reply\s+with\s+voice|give\s+me\s+an\s+audio\s+response|give\s+me\s+a\s+voice\s+response)\b/i,
    // Trailing/leading modifiers: "in voice", "by voice", "as voice", "via voice"
    /\b(in\s+voice|by\s+voice|as\s+voice|via\s+voice|by\s+audio|in\s+audio|as\s+audio)\b/i,
  ];

  return patterns.some((p) => p.test(m));
}

/**
 * Detects mutation/action intent (e.g. uploading, deleting, editing, creating, fixing code).
 * These must always remain standard text responses.
 */
export function detectActionOrMutationIntent(message: string): boolean {
  const m = message.trim().toLowerCase();

  const mutationPatterns = [
    // Imperative mutation commands at start of sentence or clear command structure
    /^\s*(upload|delete|remove|rename|create|edit|modify|update|replace|move|write|fix|implement|refactor|add|commit|push)\b/i,
    // KB and file mutations
    /\b(upload|delete|remove|rename|create|edit|modify|update|replace|move)\s+(this|my|the|a|an)?\s*(pdf|file|document|doc|knowledge\s*base|kb|directory|folder)\b/i,
    /\b(delete|rename|clear|reset)\s+(my\s+)?(knowledge\s*base|kb)\b/i,
    // Code modification actions
    /\b(fix|implement|debug|refactor|write|create)\s+(this|the|my|an?)?\s*(code|bug|api|function|class|component|method|service|feature|endpoint)\b/i,
    /\b(edit\s+this\s+file\s+and\s+fix|fix\s+the\s+bug|write\s+this\s+api)\b/i,
  ];

  return mutationPatterns.some((p) => p.test(m));
}

/**
 * Detects informational / retrieval questions targeting Knowledge Base or documents.
 */
export function detectKnowledgeInformationalIntent(
  message: string,
  hasKnowledgeContext = false
): boolean {
  const m = message.trim().toLowerCase();

  // If message is an action/mutation, it's not informational
  if (detectActionOrMutationIntent(m)) {
    return false;
  }

  const kbInfoPatterns = [
    // KB & Document listing/queries: "What does my knowledge base contain?", "What files are in my knowledge base?", "What documents do I have?"
    /\b(what|which)\s+(documents|files|kbs|knowledge\s*bases)(\s+(do\s+i\s+have|are\s+there|exist|are\s+available))?\b/i,
    /\b(what\s+(does|do|is|are|files|documents)|which\s+(files|documents)|list\s+(files|documents|kbs|knowledge\s*bases))\b.{0,60}\b(knowledge\s*base|kb|documents|files|pdfs)\b/i,
    // Topic retrieval: "Do I have anything about authentication?", "Is Docker mentioned in my files?", "Do I have any documents about X?"
    /\b(do\s+i\s+have|is\s+there|are\s+there)\s+(anything|any\s+(document|documents|file|files|notes|info|information|details))\s+(about|on|covering|related\s+to)\b/i,
    /\b(do\s+i\s+have|is\s+there|is\s+any|are\s+there|is\s+.{1,40}\s+mentioned)\b.{0,50}\b(in\s+(my\s+)?(files|documents|knowledge\s*base|kb|notes|pdf|pdfs))\b/i,
    // Document content queries: "What is this document about?", "What does this PDF contain?"
    /\b(what\s+(is|does)|how\s+does)\b.{0,40}\b(document|file|pdf|docx|notes)\b.{0,40}\b(about|contain|say|mention|cover|explain|describe)\b/i,
    // "What does requirements.pdf say about authentication?", "What is in requirements.pdf?"
    /\bwhat\s+(does|is\s+in|'s\s+in)\s+[a-zA-Z0-9_\-.]+\.(pdf|docx|txt|md)\b/i,
    // Summarization/explanation of docs: "Summarize this document", "Explain this document", "Give me a summary of this file"
    /\b(summarize|summary\s+of|give\s+me\s+a\s+summary\s+of|explain|describe|overview\s+of|brief\s+on|tell\s+me\s+what\s+(you\s+found|is\s+in))\b.{0,40}\b(document|file|pdf|notes|paper|material|[a-zA-Z0-9_\-.]+\.(pdf|docx|txt|md))\b/i,
    // "Tell me what you found in this file"
    /\btell\s+me\s+what\s+(you\s+found|is\s+in)\b.{0,30}\b(file|document|pdf)\b/i,
  ];

  if (kbInfoPatterns.some((p) => p.test(m))) {
    return true;
  }

  // If knowledge context was actually activated by context router and the query is information-seeking
  if (hasKnowledgeContext) {
    const isInfoSeeking = /\b(what|how|why|who|where|when|explain|describe|tell\s+me|summarize|is\s+there|does)\b/i.test(m);
    if (isInfoSeeking) {
      return true;
    }
  }

  return false;
}

/**
 * Determine the response delivery mode for a user turn.
 */
export function determineResponseMode(input: ResponseModeInput): ResponseMode {
  const { userMessage, selectedProviders, hasKnowledgeContext } = input;
  const trimmed = userMessage.trim();

  // 1. Explicit BOTH request takes highest priority
  if (detectExplicitBothIntent(trimmed)) {
    return 'both';
  }

  // 2. Explicit VOICE request overrides everything (even coding questions)
  if (detectExplicitVoiceIntent(trimmed)) {
    return 'voice';
  }

  // 3. Actions / Mutations / Code edits must remain TEXT
  if (detectActionOrMutationIntent(trimmed)) {
    return 'text';
  }

  // 4. Knowledge Base informational queries -> VOICE
  const isKnowledgeActive =
    hasKnowledgeContext || (selectedProviders ? selectedProviders.includes('knowledge') : false);

  if (detectKnowledgeInformationalIntent(trimmed, isKnowledgeActive)) {
    return 'voice';
  }

  // 5. Default -> TEXT
  return 'text';
}
