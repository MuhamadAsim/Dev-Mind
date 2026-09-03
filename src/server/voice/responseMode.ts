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
 * Detects CRUD / management operations on files and Knowledge Bases
 * (e.g. creating, listing, viewing files/documents/KBs, renaming, deleting, uploading).
 * Per specification: File CRUD operations are handled in standard English text,
 * while questions about knowledge base content default to Urdu voice.
 */
export function detectFileCrudIntent(message: string): boolean {
  const m = message.trim().toLowerCase();

  const crudPatterns = [
    // 1. Listing / viewing Knowledge Bases: "List the knowledge base", "List my knowledge bases", "What knowledge bases do I have?", "Show knowledge bases"
    /\b(list|show|display|view|get|see)\s+(all\s+)?(the\s+|my\s+)?(knowledge\s*bases?|knowledgebases?|kbs?)\b/i,
    /\bwhat\s+(knowledge\s*bases?|knowledgebases?|kbs?)\s+(do\s+i\s+have|are\s+(there|available|configured|created))\b/i,
    /\bwhich\s+(knowledge\s*bases?|knowledgebases?|kbs?)\b/i,

    // 2. Listing / viewing documents/files: "What documents do I have?", "What files are in my knowledge base?", "Show documents in University", "List documents", "List files", "What files do I have?"
    /\b(list|show|display|view|get|see)\s+(all\s+)?(the\s+|my\s+)?(documents?|files?|pdfs?|docs?)\b/i,
    /\bwhat\s+(documents?|files?|pdfs?|docs?)\s+(do\s+i\s+have|are\s+(there|available|uploaded|in\s+(my\s+)?knowledge\s*base))\b/i,
    /\bwhat\s+files\s+are\s+in\s+(my\s+)?(knowledge\s*base|kb)\b/i,
    /\bwhat\s+(documents|files)\s+do\s+i\s+have\b/i,
    /\bshow\s+(all\s+)?(the\s+)?documents\s+in\b/i,

    // 3. Creating / uploading files or KBs
    /\b(upload|create|add|make)\s+(this|my|the|a|an)?\s*(pdf|file|document|doc|knowledge\s*base|kb|directory|folder)\b/i,
    /\b(create|make)\s+(a\s+)?(new\s+)?(knowledge\s*base|kb)\b/i,

    // 4. Renaming / editing / moving files or KBs
    /\b(rename|modify|replace|move)\s+(this|my|the|a|an)?\s*(pdf|file|document|doc|knowledge\s*base|kb|directory|folder)\b/i,
    /\brename\s+(my\s+)?(knowledge\s*base|kb)\b/i,

    // 5. Deleting / removing files or KBs
    /\b(delete|remove|clear|reset|erase)\s+(this|my|the|a|an)?\s*(pdf|file|document|doc|knowledge\s*base|kb|directory|folder)\b/i,
    /\b(delete|remove|clear|reset)\s+(my\s+)?(knowledge\s*base|kb)\b/i,
  ];

  return crudPatterns.some((p) => p.test(m));
}

/**
 * Detects mutation/action intent (e.g. uploading, deleting, editing, creating, fixing code).
 * These must always remain standard text responses.
 */
export function detectActionOrMutationIntent(message: string): boolean {
  const m = message.trim().toLowerCase();

  // File/KB CRUD is explicitly text mode
  if (detectFileCrudIntent(m)) {
    return true;
  }

  const mutationPatterns = [
    // Imperative mutation commands at start of sentence or clear command structure
    /^\s*(upload|delete|remove|rename|create|edit|modify|update|replace|move|write|fix|implement|refactor|add|commit|push)\b/i,
    // Code modification actions
    /\b(fix|implement|debug|refactor|write|create)\s+(this|the|my|an?)?\s*(code|bug|api|function|class|component|method|service|feature|endpoint)\b/i,
    /\b(edit\s+this\s+file\s+and\s+fix|fix\s+the\s+bug|write\s+this\s+api)\b/i,
  ];

  return mutationPatterns.some((p) => p.test(m));
}

/**
 * Detects if the user explicitly requested delivery in TEXT format.
 * (e.g. "in text", "as text", "text only", "reply in text", "send as text", "in writing")
 * Allows users to override default voice delivery for knowledge base queries.
 */
export function detectExplicitTextIntent(message: string): boolean {
  const m = message.trim().toLowerCase();

  // If the user requested "both text and voice", that takes priority over text-only
  if (detectExplicitBothIntent(m)) {
    return false;
  }

  const patterns = [
    // Direct delivery modifiers: "in text", "as text", "by text", "via text", "with text"
    /\b(in\s+text|as\s+text|by\s+text|via\s+text|with\s+text)\b/i,
    // "text only", "only text", "just text"
    /\b(text\s+only|only\s+text|just\s+text)\b/i,
    // Written formats: "in writing", "written text", "written response", "as written text"
    /\b(in\s+writing|written\s+text|written\s+response|as\s+written\s+text)\b/i,
    // Action + text request: "reply in text", "reply with text", "send as text", "give me text"
    /\b(send|reply|give|answer|tell|write|respond)\s+(this|it|me|the\s+answer|the\s+response)?\s*(in|as|by|with|via)?\s*(a\s+)?(text|text\s*message|text\s*response|written\s*text)\b/i,
    // Explicit negative voice: "don't send voice", "no voice", "without voice"
    /\b(don't\s+send\s+voice|no\s+voice|without\s+voice|not\s+in\s+voice)\b/i,
  ];

  return patterns.some((p) => p.test(m));
}

/**
 * Detects informational / retrieval questions targeting Knowledge Base or documents.
 * Queries inquiring about content or facts in the knowledge base default to voice unless
 * explicitly requested in text or the request is about file CRUD operations.
 */
export function detectKnowledgeInformationalIntent(
  message: string,
  hasKnowledgeContext = false
): boolean {
  const m = message.trim().toLowerCase();

  // If user explicitly requested text delivery, do not treat as voice
  if (detectExplicitTextIntent(m)) {
    return false;
  }

  // If message is CRUD on files/KBs or an action/mutation, it must remain text
  if (detectFileCrudIntent(m) || detectActionOrMutationIntent(m)) {
    return false;
  }

  const kbInfoPatterns = [
    // Queries asking about knowledge base content or entities:
    // e.g. "Tell me about muhammad_asim and about skill from knowledge base", "Tell me about X from knowledge base"
    /\btell\s+me\s+about\b.{0,60}\b(from|in|according\s+to)\s+(the\s+)?(knowledge\s*base|kb|document|file|notes|pdf)\b/i,
    // "What does the knowledge base say/mention/contain about X?"
    /\bwhat\s+does\s+.{0,40}\b(knowledge\s*base|kb)\b.{0,40}\b(say|mention|cover|contain|discuss|explain)\b/i,
    // Classic RAG pattern: "what does X say about Y"
    /what does .{2,60} (say|mention|cover|explain|discuss|describe) about/i,
    // Skills or topics query in document: "What skills are in muhammad_asim?", "What skills are mentioned in the CV?"
    /\bwhat\s+(skills?|experience|details|information|topics?)\b.{0,50}\b(in|from|mentioned\s+in)\b/i,
    // What's in / contents of KB or doc: "What's in the University knowledge base?", "What is in my knowledge base?"
    /\bwhat\s+(is\s+in|'s\s+in|does\s+.{1,30}\s+contain)\b.{0,40}\b(knowledge\s*base|kb|university)\b/i,
    // Topic retrieval: "Do I have anything about authentication?", "Is Docker mentioned in my files?", "Do I have any documents about X?"
    /\b(do\s+i\s+have|is\s+there|are\s+there)\s+(anything|any\s+(document|documents|file|files|notes|info|information|details))\s+(about|on|covering|related\s+to)\b/i,
    /\b(do\s+i\s+have|is\s+there|is\s+any|are\s+there|is\s+.{1,40}\s+mentioned)\b.{0,50}\b(in\s+(my\s+)?(files|documents|knowledge\s*base|kb|notes|pdf|pdfs))\b/i,
    // Document content queries: "What is this document about?", "What does this PDF contain?"
    /\b(what\s+(is|does)|how\s+does)\b.{0,40}\b(document|file|pdf|docx|notes)\b.{0,40}\b(about|contain|say|mention|cover|explain|describe)\b/i,
    // Direct file inquiries: "What does requirements.pdf say about authentication?", "What is in requirements.pdf?"
    /\bwhat\s+(does|is\s+in|'s\s+in)\s+[a-zA-Z0-9_\-.]+\.(pdf|docx|txt|md)\b/i,
    // Summarization/explanation with document/file markers: "Summarize this document", "Explain this document", "Give me a summary of this file"
    /\b(summarize|summary\s+of|give\s+me\s+a\s+summary\s+of|explain|describe|overview\s+of|brief\s+on|tell\s+me\s+what\s+(you\s+found|is\s+in))\b.{0,40}\b(knowledge\s*base|kb|document|file|pdf|notes|paper|material|[a-zA-Z0-9_\-.]+\.(pdf|docx|txt|md))\b/i,
    // Direct summarization of named document/file (e.g. "Summarize muhammad_asim", "Give me summary of muhammad_asim", "Summarize this knowledgebase")
    /\b(summarize|give\s+me\s+(a\s+)?summary\s+of|summary\s+of)\s+(?!this\s+code|this\s+function|this\s+repo|code|function|class|method|repo|repository|api|bug|error)([a-zA-Z0-9_\-.]+)/i,
    // Reading or inspecting document/file: "Read muhammad_asim", "What is in muhammad_asim?", "Tell me what you found in muhammad_asim"
    /\b(read|tell\s+me\s+what\s+(is\s+in|you\s+found\s+in)|what\s+(is|'s|does)\s+(in|inside|say))\s+(?!code|function|class|repo|branch)([a-zA-Z0-9_\-.]+)/i,
    // Specific field or fact inquiries from document/KB: e.g. "Can you tell me adress only", "What is his email?", "Tell me his contact"
    /\b(can\s+you\s+)?(tell|give|show|share|provide|what\s+is)\b.{0,30}\b(add?ress|contact|email|phone|number|location|city|skills?|experience|education|degree|qualification|projects?|summary|details|info|information)\b/i,
    /\b(add?ress|contact|phone|email|location|qualification|skills?|experience|education)\s+(only|please)?\b/i,
    // Inquiries about fields / follow-ups: e.g. "And education", "Now tell me the adress", "his degree", "projects"
    /\b(and\s+|now\s+)?(education|degree|qualification|college|university|school|gpa)\b/i,
    /\b(and\s+|now\s+)?(add?ress|contact|phone|email|location|city)\b/i,
    /\b(and\s+|now\s+)?(skills?|experience|projects?|background|work)\b/i,
    /\bwhere\s+(does|is)\s+(he|she|they|it)\b/i,
    /\bwho\s+is\b/i,
    /\btell\s+me\s+more\b/i,
    // "Tell me what you found in this file"
    /\btell\s+me\s+what\s+(you\s+found|is\s+in)\b.{0,30}\b(file|document|pdf)\b/i,
  ];

  if (kbInfoPatterns.some((p) => p.test(m))) {
    return true;
  }

  // If knowledge context was actually activated by context router, ongoing conversation, or context builder
  // and the message is not an action, file CRUD, or explicit text request:
  if (hasKnowledgeContext) {
    return true;
  }

  return false;
}

/**
 * Determine the response delivery mode for a user turn.
 */
export function determineResponseMode(input: ResponseModeInput): ResponseMode {
  const { userMessage, selectedProviders, hasKnowledgeContext, conversationHasKnowledge } = input;
  const trimmed = userMessage.trim();

  // 1. Explicit BOTH request takes highest priority
  if (detectExplicitBothIntent(trimmed)) {
    return 'both';
  }

  // 2. Explicit VOICE request overrides everything (even coding questions)
  if (detectExplicitVoiceIntent(trimmed)) {
    return 'voice';
  }

  // 3. Explicit TEXT request overrides knowledge base default voice mode
  // (e.g. "Summarize this file in text", "What files are in my knowledge base as text")
  if (detectExplicitTextIntent(trimmed)) {
    return 'text';
  }

  // 4. File CRUD operations and code mutations must remain TEXT (English)
  if (detectFileCrudIntent(trimmed) || detectActionOrMutationIntent(trimmed)) {
    return 'text';
  }

  // 5. Knowledge Base informational queries & content inquiries -> VOICE (Urdu)
  const isKnowledgeActive =
    hasKnowledgeContext ||
    Boolean(conversationHasKnowledge) ||
    (selectedProviders ? selectedProviders.includes('knowledge') : false);

  if (detectKnowledgeInformationalIntent(trimmed, isKnowledgeActive)) {
    return 'voice';
  }

  // 6. Default -> TEXT
  return 'text';
}
