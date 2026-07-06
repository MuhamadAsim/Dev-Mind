// ============================================================
// OpenRouter Provider
// Uses @ai-sdk/openai pointed at OpenRouter's OpenAI-compatible
// endpoint. Switching to native OpenAI is a one-line baseURL change.
// Switching to Anthropic/Gemini = a new file in this folder.
// ============================================================
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, isStepCount } from 'ai';
import type { AIMessage, AIProvider, AIProviderConfig, ChatSession } from '../types';
import { createRepositoryTools } from '../tools';

export function createOpenRouterProvider(config: AIProviderConfig): AIProvider {
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
      instructions: string | undefined,
      session: ChatSession
    ): Promise<ReadableStream<string>> {
      // Tools are ALWAYS registered now — even with no active repo — so the
      // LLM can call listConnectedRepos / selectRepo before touching any
      // repo-content tool. `session` is shared by reference: if selectRepo
      // fires mid-turn, session.activeRepoId changes and every tool called
      // afterward (in this same 5-step loop) sees the new value.
      const tools = createRepositoryTools(session);

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