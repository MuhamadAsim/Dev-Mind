// ============================================================
// LangSmith Tracing — AI SDK Wrapper
//
// This module is the single point of integration between LangSmith
// and the Vercel AI SDK. Every file that needs `streamText` or
// `generateText` imports the traced version from here instead of
// directly from `'ai'`.
//
// When `LANGSMITH_TRACING=true` (+ a valid LANGSMITH_API_KEY),
// wrapAISDK intercepts every AI SDK call and logs it to LangSmith.
// When tracing is disabled the wrapper is a transparent no-op, so
// app behavior is identical to an unwrapped import.
//
// Re-exports `createLangSmithProviderOptions` so call-sites can
// attach per-call metadata/tags without an extra import.
// ============================================================
import * as ai from 'ai';
import { wrapAISDK, createLangSmithProviderOptions } from 'langsmith/experimental/vercel';

export const { generateText, streamText, generateObject, streamObject } = wrapAISDK(ai);

export { createLangSmithProviderOptions };

