// ============================================================
// Voice & TTS Service Types
// ============================================================

export type ResponseMode = 'text' | 'voice' | 'both';

export interface VoiceOptions {
  voiceId?: string;
  outputFormat?: string;
  maxTextLength?: number;
  timeoutMs?: number;
}

export interface VoiceResult {
  audioBuffer: Buffer;
  mimeType: string;
  format: string;
  durationMs?: number;
}

export interface VoiceProvider {
  readonly name: string;
  synthesize(text: string, options?: VoiceOptions): Promise<VoiceResult>;
}

export interface ResponseModeInput {
  userMessage: string;
  activeRepositoryId?: string | null;
  selectedProviders?: string[];
  hasKnowledgeContext?: boolean;
  conversationHasKnowledge?: boolean;
}
