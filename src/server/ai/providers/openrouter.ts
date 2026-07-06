// ============================================================
// OpenRouter Provider
// Uses @ai-sdk/openai pointed at OpenRouter's OpenAI-compatible
// endpoint. Switching to native OpenAI is a one-line baseURL change.
// Switching to Anthropic/Gemini = a new file in this folder.
// ============================================================
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, isStepCount } from 'ai';
import type { AIMessage, AIProvider, AIProviderConfig } from '../types';
import { createRepositoryTools } from '../tools';

export function createOpenRouterProvider(config: AIProviderConfig): AIProvider {
  // @ai-sdk/openai accepts any OpenAI-compatible baseURL
  const openrouter = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl ?? 'https://openrouter.ai/api/v1',
    headers: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      'X-Title': 'DevMind AI',
    },
  });

  return {
    async stream(
      messages: AIMessage[],
      model: string,
      instructions?: string,
      activeRepoId?: string | null
    ): Promise<ReadableStream<string>> {
      // Register tools if there is an active repository connected.
      const tools = activeRepoId ? createRepositoryTools(activeRepoId) : undefined;

      // FIX: this AI SDK version's streamText validates that NO message in
      // `messages` may have role 'system' — regardless of model type — and
      // requires the system prompt to go through the dedicated `instructions`
      // field instead. Our earlier attempt to pass `instructions` failed
      // only because the model was still resolving to the Responses API
      // accessor (openrouter(model)); now that we're correctly on
      // openrouter.chat(model), `instructions` is the right mechanism.
      const result = await streamText({
        model: openrouter.chat(model),
        instructions,
        messages,
        tools,
        stopWhen: isStepCount(5), // Enable multi-step tool calls
      });

      // result.textStream is an AsyncIterable<string>; convert to ReadableStream<string>
      return result.textStream.pipeThrough(
        new TransformStream<string, string>({
          transform(chunk, controller) {
            controller.enqueue(chunk);
          },
        })
      );
    },
  };
}