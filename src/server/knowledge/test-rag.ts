/**
 * test-rag.ts — Phase 9 RAG verification script
 *
 * Run with:
 *   npx ts-node -e "require('./src/server/knowledge/test-rag')"
 * OR (ts-node in ESM mode):
 *   npx tsx src/server/knowledge/test-rag.ts
 *
 * Requires:
 *   - MONGODB_URI in .env.local
 *   - EMBEDDING_SERVICE_URL in .env.local
 *   - Embedding service running (cd embeddingService && uvicorn server:app --port 8001)
 */

// Load .env.local
import { config } from 'dotenv';
config({ path: '.env.local' });

import { verifyEmbeddingService, getEmbedding, getEmbeddings } from './embeddingService';
import { vectorStoreProvider } from './storage/vectorStore';
import { retrieve } from './retrievalService';
import { connectDB } from '../db/mongoose';
import mongoose from 'mongoose';

async function run() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  DevMind AI — Phase 9 RAG Verification Script');
  console.log('═══════════════════════════════════════════════════\n');

  // ── Step 1: Embedding service health check ────────────────
  console.log('▶ Step 1: Embedding service health check...');
  try {
    const health = await verifyEmbeddingService();
    console.log(`  ✓ Status: ${health.status}`);
    console.log(`  ✓ Model: ${health.model}`);
    console.log(`  ✓ Dimensions: ${health.dimensions}`);
  } catch (err: any) {
    console.error(`  ✗ Health check FAILED: ${err.message}`);
    console.error('    Make sure EMBEDDING_SERVICE_URL is set and the Python server is running.');
    process.exit(1);
  }

  // ── Step 2: Single embedding generation ──────────────────
  console.log('\n▶ Step 2: Single embedding generation...');
  const singleText = 'TypeScript is a typed superset of JavaScript.';
  const embedding = await getEmbedding(singleText);
  console.log(`  ✓ Generated embedding: ${embedding.length} dimensions`);
  console.log(`  ✓ First 5 values: [${embedding.slice(0, 5).map(n => n.toFixed(4)).join(', ')}]`);

  // ── Step 3: Batched embedding generation ─────────────────
  console.log('\n▶ Step 3: Batched embedding generation (3 texts)...');
  const batchTexts = [
    'MongoDB is a NoSQL document database.',
    'Next.js is a React framework for production.',
    'Vector search enables semantic similarity queries.',
  ];
  const batchEmbeddings = await getEmbeddings(batchTexts);
  console.log(`  ✓ Generated ${batchEmbeddings.length} embeddings`);
  batchEmbeddings.forEach((e, i) => {
    console.log(`  ✓ Text ${i + 1}: ${e.length} dimensions`);
  });

  // ── Step 4: Vector store save + search ───────────────────
  console.log('\n▶ Step 4: Vector store save + search...');
  await connectDB();

  const testKbId = new mongoose.Types.ObjectId().toString();
  const testDocId = new mongoose.Types.ObjectId().toString();

  const chunks = batchTexts.map((text, i) => ({
    chunkId: new mongoose.Types.ObjectId().toString(),
    documentId: testDocId,
    knowledgeBaseId: testKbId,
    index: i,
    text,
    charStart: 0,
    charEnd: text.length,
    embedding: batchEmbeddings[i],
  }));

  await vectorStoreProvider.saveChunks(chunks);
  console.log(`  ✓ Saved ${chunks.length} test chunks to vector store`);

  // ── Step 5: Retrieval ────────────────────────────────────
  console.log('\n▶ Step 5: Retrieval test...');
  const query = 'What is MongoDB?';
  console.log(`  Query: "${query}"`);
  const results = await retrieve(query, { knowledgeBaseId: testKbId, limit: 3 });

  if (results.length === 0) {
    console.warn('  ⚠ No results returned. If using local MongoDB (not Atlas), $vectorSearch may not be available.');
    console.warn('  ⚠ Create the Atlas Vector Search index to enable retrieval.');
  } else {
    console.log(`  ✓ Retrieved ${results.length} chunks:`);
    results.forEach((r, i) => {
      console.log(`    ${i + 1}. [score=${r.score.toFixed(4)}] "${r.text.slice(0, 80)}..."`);
    });
  }

  // ── Step 6: Cleanup test chunks ──────────────────────────
  console.log('\n▶ Step 6: Cleaning up test data...');
  await vectorStoreProvider.deleteChunksByDocument(testDocId);
  console.log('  ✓ Test chunks deleted');

  console.log('\n✅ Phase 9 RAG verification complete!\n');
  process.exit(0);
}

run().catch((err) => {
  console.error('\n✗ Verification failed:', err.message || err);
  process.exit(1);
});
