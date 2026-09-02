// ============================================================
// Uplift AI Voice Provider
//
// Synthesizes speech using the Uplift AI Text-to-Speech API.
// Never exposes the API key to client or logs.
// ============================================================

import type { VoiceProvider, VoiceOptions, VoiceResult } from '../types';

export class UpliftVoiceProvider implements VoiceProvider {
  readonly name = 'uplift';

  private readonly defaultVoiceId = process.env.UPLIFT_VOICE_ID || 'prime-time-anchor';
  private readonly defaultOutputFormat = 'MP3_22050_128';
  private readonly endpoint = 'https://api.upliftai.org/v1/synthesis/text-to-speech';

  async synthesize(text: string, options: VoiceOptions = {}): Promise<VoiceResult> {
    const apiKey = process.env.UPLIFT_API?.trim();
    if (!apiKey) {
      throw new Error('[Uplift] UPLIFT_API environment variable is missing or empty.');
    }

    const voiceId = options.voiceId || this.defaultVoiceId;
    const outputFormat = options.outputFormat || this.defaultOutputFormat;
    const timeoutMs =
      options.timeoutMs ??
      (process.env.UPLIFT_TIMEOUT_MS ? parseInt(process.env.UPLIFT_TIMEOUT_MS, 10) : 15000);

    const startTime = Date.now();
    console.log(
      `[TTS] Starting speech synthesis via Uplift AI (voiceId="${voiceId}", format="${outputFormat}", textLength=${text.length})...`
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voiceId,
          text,
          outputFormat,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        let errorDetails = '';
        try {
          errorDetails = await response.text();
        } catch {
          errorDetails = response.statusText;
        }
        throw new Error(
          `[Uplift] HTTP error ${response.status} (${response.statusText}): ${errorDetails}`
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);
      const durationMs = Date.now() - startTime;

      console.log(
        `[TTS] Speech synthesized successfully in ${durationMs}ms (${audioBuffer.length} bytes).`
      );

      return {
        audioBuffer,
        mimeType: 'audio/mpeg',
        format: outputFormat,
        durationMs,
      };
    } catch (err: any) {
      clearTimeout(timer);
      const isAbort = err.name === 'AbortError' || controller.signal.aborted;
      const errorMsg = isAbort
        ? `Request timed out after ${timeoutMs}ms`
        : err.message || String(err);

      console.error(`[TTS] Synthesis failed: ${errorMsg}`);
      throw new Error(`[Uplift] ${errorMsg}`);
    }
  }
}
