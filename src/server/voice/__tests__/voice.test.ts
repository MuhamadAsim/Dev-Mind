// ============================================================
// Automated Test Suite for Voice Service & Response Mode Routing
// Run with: npx tsx src/server/voice/__tests__/voice.test.ts
// ============================================================

import assert from 'node:assert';
import {
  determineResponseMode,
  detectExplicitVoiceIntent,
  detectExplicitBothIntent,
  detectActionOrMutationIntent,
  detectKnowledgeInformationalIntent,
} from '../responseMode';
import { sanitizeForTTS } from '../textSanitizer';
import {
  synthesizeSpeech,
  setVoiceProvider,
  getVoiceProvider,
} from '../voiceService';
import { UpliftVoiceProvider } from '../providers/uplift';
import type { VoiceProvider, VoiceOptions, VoiceResult } from '../types';

let totalTests = 0;
let passedTests = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      await res;
    }
    passedTests++;
    console.log(`  ✅ ${name}`);
  } catch (err: any) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${err.message}`);
    process.exitCode = 1;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 Running Voice Response & Intent Routing Tests');
  console.log('======================================================\n');

  console.log('--- 1. Knowledge Base Informational Queries (Expected: VOICE) ---');

  const kbVoiceQueries = [
    'What does my knowledge base contain?',
    'What files are in my knowledge base?',
    'What documents do I have?',
    'Do I have anything about authentication?',
    'Is Docker mentioned in my files?',
    'Is authentication mentioned in my files?',
    'What is this document about?',
    'What does this PDF contain?',
    'Summarize this document.',
    'Give me a summary of this file.',
    'Explain this document.',
    'What does requirements.pdf say about authentication?',
    'What is in requirements.pdf?',
    'Tell me what you found in this file.',
  ];

  for (const q of kbVoiceQueries) {
    test(`KB Info: "${q}" -> voice`, () => {
      const mode = determineResponseMode({ userMessage: q });
      assert.strictEqual(
        mode,
        'voice',
        `Expected "voice" for "${q}", but got "${mode}"`
      );
    });
  }

  test('KB Info via active knowledge context: "Tell me about the setup" with hasKnowledgeContext=true -> voice', () => {
    const mode = determineResponseMode({
      userMessage: 'Tell me about the setup',
      hasKnowledgeContext: true,
    });
    assert.strictEqual(mode, 'voice');
  });

  console.log('\n--- 2. Actions / Mutations / Uploads (Expected: TEXT) ---');

  const actionTextQueries = [
    'Upload this PDF.',
    'Upload this PDF to my knowledge base.',
    'Upload requirements.pdf',
    'Delete this document.',
    'Delete requirements.pdf',
    'Rename this file.',
    'Rename this document.',
    'Edit this document.',
    'Create a document.',
    'Create a new knowledge base.',
    'Delete my knowledge base.',
    'Rename my knowledge base.',
    'Replace this file.',
    'Move this document.',
  ];

  for (const q of actionTextQueries) {
    test(`Action: "${q}" -> text`, () => {
      const mode = determineResponseMode({ userMessage: q });
      assert.strictEqual(
        mode,
        'text',
        `Expected "text" for "${q}", but got "${mode}"`
      );
    });
  }

  console.log('\n--- 3. Coding Queries without Voice (Expected: TEXT) ---');

  const codeTextQueries = [
    'Fix this code.',
    'Write this API.',
    'Implement authentication.',
    'Why is this function failing?',
    'Edit this file and fix the bug.',
    'Create a new component.',
  ];

  for (const q of codeTextQueries) {
    test(`Coding query: "${q}" -> text`, () => {
      const mode = determineResponseMode({ userMessage: q });
      assert.strictEqual(
        mode,
        'text',
        `Expected "text" for "${q}", but got "${mode}"`
      );
    });
  }

  console.log('\n--- 4. Explicit Voice Requests (Expected: VOICE) ---');

  const explicitVoiceQueries = [
    'Send this as voice.',
    'Reply with voice.',
    'Give me an audio response.',
    'Send me a voice message.',
    'Explain this in voice.',
    'Tell me this by voice.',
    'Explain why this code is failing and send it as voice.',
    'Explain this code in voice',
  ];

  for (const q of explicitVoiceQueries) {
    test(`Explicit voice: "${q}" -> voice`, () => {
      const mode = determineResponseMode({ userMessage: q });
      assert.strictEqual(
        mode,
        'voice',
        `Expected "voice" for "${q}", but got "${mode}"`
      );
    });
  }

  console.log('\n--- 5. Explicit BOTH Requests (Expected: BOTH) ---');

  const explicitBothQueries = [
    'Send the answer as text and voice.',
    'Send voice too.',
    'Give me both.',
    'Summarize this document and send voice too.',
    'Give me both text and voice',
    'Reply with text and voice',
  ];

  for (const q of explicitBothQueries) {
    test(`Explicit both: "${q}" -> both`, () => {
      const mode = determineResponseMode({ userMessage: q });
      assert.strictEqual(
        mode,
        'both',
        `Expected "both" for "${q}", but got "${mode}"`
      );
    });
  }

  console.log('\n--- 6. Non-Delivery Voice Topics (Negative Cases -> TEXT) ---');

  const nonDeliveryQueries = [
    'How do I implement voice authentication in Next.js?',
    'Explain voice recognition algorithms.',
    'What is the difference between active voice and passive voice?',
  ];

  for (const q of nonDeliveryQueries) {
    test(`Topic query: "${q}" -> text`, () => {
      const mode = determineResponseMode({ userMessage: q });
      assert.strictEqual(
        mode,
        'text',
        `Expected "text" for topic "${q}", but got "${mode}"`
      );
    });
  }

  console.log('\n--- 7. Text Sanitizer for TTS ---');

  test('Sanitizes markdown, headers, bullets, and code blocks', () => {
    const rawMarkdown = `
# Document Summary

Here is what **requirements.pdf** contains:
- **Authentication**: JWT & OAuth2
- *Database*: MongoDB

\`\`\`typescript
const token = jwt.sign({ id: user.id }, SECRET);
console.log("Generated token");
\`\`\`

For more details, visit [Docs](https://example.com).
> Note: Keep secrets safe!
`;

    const sanitized = sanitizeForTTS(rawMarkdown);
    assert(!sanitized.includes('```'), 'Must strip code fences');
    assert(!sanitized.includes('# Document Summary'), 'Must strip header hash symbols');
    assert(!sanitized.includes('**requirements.pdf**'), 'Must strip bold asterisks');
    assert(!sanitized.includes('[Docs]'), 'Must clean link syntax');
    assert(!sanitized.includes('> Note:'), 'Must strip blockquote symbols');
    assert(sanitized.includes('requirements.pdf contains'), 'Must preserve core content');
    assert(sanitized.includes('Authentication: JWT & OAuth2'), 'Must preserve bullet points text');
  });

  test('Truncates cleanly at sentence boundary when exceeding maxTextLength', () => {
    const longText =
      'First sentence is short. Second sentence gives key information. Third sentence explains further details that might be truncated if exceeding character limits.';
    const sanitized = sanitizeForTTS(longText, { maxTextLength: 60 });
    assert(sanitized.length <= 60, `Length ${sanitized.length} must be <= 60`);
    assert(sanitized.endsWith('.'), 'Should truncate at sentence boundary if possible');
  });

  console.log('\n--- 8. Voice Service Fallback & Provider Handling ---');

  await test('Graceful fallback to null when synthesis provider fails', async () => {
    const originalProvider = getVoiceProvider();

    // Mock failing provider
    const failingProvider: VoiceProvider = {
      name: 'mock-failing',
      async synthesize() {
        throw new Error('API Rate limit reached');
      },
    };

    setVoiceProvider(failingProvider);

    try {
      const result = await synthesizeSpeech('Hello world');
      assert.strictEqual(result, null, 'Should return null on failure without throwing');
    } finally {
      setVoiceProvider(originalProvider);
    }
  });

  await test('Successful synthesis returns audio buffer with valid provider', async () => {
    const originalProvider = getVoiceProvider();

    // Mock successful provider
    const mockSuccessProvider: VoiceProvider = {
      name: 'mock-success',
      async synthesize(text: string) {
        return {
          audioBuffer: Buffer.from('MOCK_MP3_AUDIO_DATA'),
          mimeType: 'audio/mpeg',
          format: 'MP3_22050_128',
          durationMs: 120,
        };
      },
    };

    setVoiceProvider(mockSuccessProvider);

    try {
      const result = await synthesizeSpeech('Hello from mock');
      assert(result !== null, 'Result should not be null');
      assert.strictEqual(result.mimeType, 'audio/mpeg');
      assert.strictEqual(result.format, 'MP3_22050_128');
      assert.strictEqual(result.audioBuffer.toString(), 'MOCK_MP3_AUDIO_DATA');
    } finally {
      setVoiceProvider(originalProvider);
    }
  });

  console.log('\n--- 6. Audio Converter & Local Audio Logger ---');

  const { convertToOpusVoiceNote, saveAudioFile } = await import('../audioConverter');
  const fs = await import('node:fs');

  await test('saveAudioFile creates file locally in data/audio_logs', async () => {
    const testBuf = Buffer.from('TEST_AUDIO_PAYLOAD');
    const savedPath = await saveAudioFile(testBuf, 'test_audio', 'mp3');
    assert(savedPath !== null, 'Saved path should not be null');
    assert(fs.existsSync(savedPath), 'File should exist on disk');
    const readBuf = fs.readFileSync(savedPath);
    assert.strictEqual(readBuf.toString(), 'TEST_AUDIO_PAYLOAD');
    // Clean up test file
    fs.unlinkSync(savedPath);
  });

  await test('convertToOpusVoiceNote handles empty/invalid buffer safely without crashing', async () => {
    const invalidBuf = Buffer.from('not an audio stream');
    const result = await convertToOpusVoiceNote(invalidBuf);
    // Invalid buffer should safely return null rather than crashing
    assert.strictEqual(result, null);
  });

  console.log('\n======================================================');
  console.log(`📊 Test Summary: ${passedTests} / ${totalTests} passed`);
  console.log('======================================================\n');
}

runTests();
