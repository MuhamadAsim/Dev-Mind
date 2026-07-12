// ============================================================
// Embedding Service
//
// Client wrapper for SentenceTransformers embedding service.
// Strict enforcement: URLs are read exclusively from the environment
// variable `EMBEDDING_SERVICE_URL`. If not set, an error is thrown.
//
// Features:
//   - Batched chunk processing (groups requests in batches of 32)
//   - Parallel execution across batches with Promise.all
//   - Zero hardcoded fallback URLs
// ============================================================

const BATCH_SIZE = 32;

function getEmbeddingServiceUrl(): string {
  const url = process.env.EMBEDDING_SERVICE_URL;
  if (!url) {
    throw new Error(
      'Missing EMBEDDING_SERVICE_URL environment variable. Set it in .env.local (e.g. EMBEDDING_SERVICE_URL=http://127.0.0.1:8001).'
    );
  }
  return url.replace(/\/+$/, ''); // Strip trailing slashes
}

interface EmbedResponse {
  model: string;
  dimensions: number;
  embeddings: number[][];
}

/**
 * Generate a single embedding vector for a string query.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const serviceUrl = getEmbeddingServiceUrl();
  const res = await fetch(`${serviceUrl}/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts: [text] }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Embedding service returned HTTP ${res.status}: ${errText || res.statusText}`
    );
  }

  const data = (await res.json()) as EmbedResponse;
  if (!data.embeddings || data.embeddings.length === 0) {
    throw new Error('Embedding service returned empty embeddings array.');
  }

  return data.embeddings[0];
}

/**
 * Generate embedding vectors for multiple texts.
 * Splits inputs into batches of BATCH_SIZE (32) and processes them in parallel.
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const serviceUrl = getEmbeddingServiceUrl();

  // Create batches of size BATCH_SIZE
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    batches.push(texts.slice(i, i + BATCH_SIZE));
  }

  // Execute all batches in parallel
  const batchPromises = batches.map(async (batch, batchIndex) => {
    const res = await fetch(`${serviceUrl}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: batch }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(
        `Embedding service error on batch ${batchIndex + 1}/${batches.length}: HTTP ${res.status} - ${errText}`
      );
    }

    const data = (await res.json()) as EmbedResponse;
    if (!data.embeddings || data.embeddings.length !== batch.length) {
      throw new Error(
        `Embedding service returned mismatching embeddings array length for batch ${batchIndex + 1}. Expected ${batch.length}, got ${data.embeddings?.length ?? 0}`
      );
    }

    return data.embeddings;
  });

  const resolvedBatches = await Promise.all(batchPromises);

  // Flatten the array of results back into the original order
  return resolvedBatches.flat();
}

/**
 * Health check verification.
 */
export async function verifyEmbeddingService(): Promise<{ status: string; model: string; dimensions: number }> {
  const serviceUrl = getEmbeddingServiceUrl();
  const res = await fetch(`${serviceUrl}/health`);
  if (!res.ok) {
    throw new Error(`Embedding service health check failed with HTTP ${res.status}`);
  }
  return res.json() as Promise<{ status: string; model: string; dimensions: number }>;
}
