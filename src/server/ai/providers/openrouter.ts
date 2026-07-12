// ============================================================
// OpenRouter Provider
// ============================================================
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, isStepCount } from 'ai';
import type { AIMessage, AIProvider, AIProviderConfig, ChatSession, ChatStreamPart } from '../types';
import { createRepositoryTools, createContextTools, createKnowledgeTools } from '../tools';

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
    ): Promise<ReadableStream<ChatStreamPart>> {
      const repoTools = createRepositoryTools(session);
      const contextTools = await createContextTools(session);
      const knowledgeTools = createKnowledgeTools(session);
      const tools = { ...repoTools, ...contextTools, ...knowledgeTools };
      console.log("========== LLM MESSAGES ==========");

      messages.forEach((m, i) => {
        const text =
          typeof m.content === "string"
            ? m.content
            : JSON.stringify(m.content);

        console.log({
          index: i,
          role: m.role,
          chars: text.length,
        });
      });

      console.log("=================================");
      const result = await streamText({
        model: openrouter.chat(model),
        instructions,
        messages,
        tools,
        stopWhen: isStepCount(12),
      });

      // CHANGED: previously piped result.textStream (text only — this is
      // where tool-call visibility was being silently thrown away).
      // fullStream carries text AND tool-call/tool-result parts, in the
      // real order the model produced them.
      return new ReadableStream<ChatStreamPart>({
        async start(controller) {
          try {
            for await (const part of result.fullStream) {
              // VERIFY: field names below assume AI SDK v5 (input/output).
              // If nothing shows up client-side, add:
              //   console.log('[openrouter] part:', part.type, part);
              // here once, and adjust field names to match what you see.
              switch (part.type) {
                case 'text-delta':
                  controller.enqueue({ type: 'text', text: part.text });
                  break;

                case 'tool-call':
                  controller.enqueue({
                    type: 'tool-call',
                    toolCallId: part.toolCallId,
                    toolName: part.toolName,
                    input: part.input as Record<string, unknown>,
                  });
                  break;

                case 'tool-result':
                  controller.enqueue({
                    type: 'tool-result',
                    toolCallId: part.toolCallId,
                    toolName: part.toolName,
                    output: part.output,
                  });
                  break;

                // 'start', 'finish', 'step-start', 'step-finish', etc. —
                // internal bookkeeping we don't need to surface. Errors
                // inside the stream throw and are caught below.
                default:
                  break;
              }
            }
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
      });
    },
  };
}