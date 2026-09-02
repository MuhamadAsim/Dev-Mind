// ============================================================
// Voice Service
//
// Central coordination layer for speech synthesis (TTS).
// Handles text sanitization, provider execution, and fallback safety.
// ============================================================

import type { VoiceProvider, VoiceOptions, VoiceResult, ResponseMode, ResponseModeInput } from './types';
import { UpliftVoiceProvider } from './providers/uplift';
import { sanitizeForTTS } from './textSanitizer';
import { determineResponseMode } from './responseMode';

let activeProvider: VoiceProvider = new UpliftVoiceProvider();

export function setVoiceProvider(provider: VoiceProvider): void {
  activeProvider = provider;
}

export function getVoiceProvider(): VoiceProvider {
  return activeProvider;
}

/**
 * Synthesizes speech from a raw LLM answer string.
 * Automatically sanitizes Markdown/code and handles errors gracefully with fallback.
 *
 * @returns VoiceResult with MP3 Buffer on success, or null if synthesis fails/is unavailable.
 */
export async function synthesizeSpeech(
  rawText: string,
  options: VoiceOptions = {}
): Promise<VoiceResult | null> {
  const sanitized = sanitizeForTTS(rawText, { maxTextLength: options.maxTextLength });

  if (!sanitized) {
    console.warn('[TTS] Sanitized text is empty. Skipping voice synthesis.');
    return null;
  }

  try {
    const result = await activeProvider.synthesize(sanitized, options);
    return result;
  } catch (err: any) {
    console.error(
      `[TTS] Speech synthesis failed (${err.message || String(err)}). Falling back to text.`
    );
    return null;
  }
}

export { determineResponseMode, sanitizeForTTS };
export type { ResponseMode, ResponseModeInput, VoiceOptions, VoiceResult, VoiceProvider };
