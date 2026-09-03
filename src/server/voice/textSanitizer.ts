// ============================================================
// Text Sanitizer for Text-to-Speech (TTS)
//
// Cleans LLM Markdown and code syntax to create natural, fluid
// spoken text while preserving the factual meaning of the answer.
// ============================================================

export interface SanitizeOptions {
  maxTextLength?: number;
}

export function sanitizeForTTS(text: string, options: SanitizeOptions = {}): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const maxLen =
    options.maxTextLength ??
    (process.env.UPLIFT_MAX_TEXT_LENGTH ? parseInt(process.env.UPLIFT_MAX_TEXT_LENGTH, 10) : 1000);

  let cleaned = text.trim();

  // 1. Remove code blocks (multi-line code fences)
  cleaned = cleaned.replace(/```[\s\S]*?```/g, ' [code omitted] ');

  // 2. Remove inline code backticks: `const a = 1` -> const a = 1
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

  // 3. Remove Markdown image links: ![alt](url) -> ''
  cleaned = cleaned.replace(/!\[[^\]]*\]\([^)]*\)/g, '');

  // 4. Clean Markdown links: [anchor text](url) -> anchor text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

  // 5. Remove HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, '');

  // 6. Remove Markdown headers (e.g. # Title, ## Subtitle)
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');

  // 7. Remove bold / italic markers: **text**, *text*, __text__, _text_
  cleaned = cleaned.replace(/(\*\*|__)(.*?)\1/g, '$2');
  cleaned = cleaned.replace(/(\*|_)(.*?)\1/g, '$2');
  cleaned = cleaned.replace(/~~(.*?)~~/g, '$1'); // strikethrough

  // 8. Clean Markdown bullet points and numbered lists
  cleaned = cleaned.replace(/^\s*[-*+]\s+/gm, '');
  cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, '');

  // 9. Clean Markdown blockquotes
  cleaned = cleaned.replace(/^\s*>\s*/gm, '');

  // 10. Replace multiple spaces, tabs, and newlines with a single space / clean sentence break
  cleaned = cleaned.replace(/\r\n|\r|\n/g, ' ');
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  // 11. Truncate cleanly at maxLen (preferring sentence boundary)
  if (cleaned.length > maxLen) {
    const truncated = cleaned.slice(0, maxLen);
    const lastPunctuation = Math.max(
      truncated.lastIndexOf('. '),
      truncated.lastIndexOf('? '),
      truncated.lastIndexOf('! '),
      truncated.lastIndexOf('۔ '),
      truncated.lastIndexOf('۔'),
      truncated.lastIndexOf('؟ '),
      truncated.lastIndexOf('؟')
    );

    if (lastPunctuation > maxLen * 0.5) {
      cleaned = truncated.slice(0, lastPunctuation + 1).trim();
    } else {
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > 0) {
        cleaned = truncated.slice(0, lastSpace) + '...';
      } else {
        cleaned = truncated + '...';
      }
    }
  }

  return cleaned;
}
