// ============================================================
// MongoVectorStoreProvider — MongoDB Atlas implementation of VectorStoreProvider
//
// Uses the `$vectorSearch` aggregation stage.
// For local MongoDB instances where Atlas Vector Search is not available,
// it logs a warning and returns an empty array to prevent server crashes.
// ============================================================
import mongoose from 'mongoose';
import { connectDB } from '../../db/mongoose';
import { DocumentChunkModel } from '../../db/models/DocumentChunk';
import type { VectorStoreProvider, VectorStoreChunkInput, VectorStoreChunk } from './vectorStoreProvider';

export class MongoVectorStoreProvider implements VectorStoreProvider {
  async saveChunks(chunks: VectorStoreChunkInput[]): Promise<void> {
    await connectDB();
    if (chunks.length === 0) return;

    // Bulk write is more efficient for large batches than insertMany
    const bulkOps = chunks.map((c) => ({
      insertOne: {
        document: {
          _id: c.chunkId ? new mongoose.Types.ObjectId(c.chunkId) : undefined,
          documentId: new mongoose.Types.ObjectId(c.documentId),
          knowledgeBaseId: new mongoose.Types.ObjectId(c.knowledgeBaseId),
          index: c.index,
          text: c.text,
          charStart: c.charStart,
          charEnd: c.charEnd,
          embedding: c.embedding,
        },
      },
    }));

    await DocumentChunkModel.bulkWrite(bulkOps);
  }

  async deleteChunksByDocument(documentId: string): Promise<void> {
    await connectDB();
    if (!mongoose.Types.ObjectId.isValid(documentId)) return;
    await DocumentChunkModel.deleteMany({
      documentId: new mongoose.Types.ObjectId(documentId),
    });
  }

  async deleteChunksByKnowledgeBase(knowledgeBaseId: string): Promise<void> {
    await connectDB();
    if (!mongoose.Types.ObjectId.isValid(knowledgeBaseId)) return;
    await DocumentChunkModel.deleteMany({
      knowledgeBaseId: new mongoose.Types.ObjectId(knowledgeBaseId),
    });
  }

  async similaritySearch(
    queryVector: number[],
    options: { knowledgeBaseId?: string; limit?: number }
  ): Promise<VectorStoreChunk[]> {
    await connectDB();
    const indexName = process.env.MONGODB_VECTOR_INDEX ?? 'vector_index';
    const limit = options.limit ?? 5;

    const vectorSearchStage: any = {
      index: indexName,
      path: 'embedding',
      queryVector,
      numCandidates: Math.max(limit * 10, 50),
      limit,
    };

    if (options.knowledgeBaseId) {
      if (!mongoose.Types.ObjectId.isValid(options.knowledgeBaseId)) {
        throw new Error(`Invalid knowledgeBaseId format: ${options.knowledgeBaseId}`);
      }
      vectorSearchStage.filter = {
        knowledgeBaseId: new mongoose.Types.ObjectId(options.knowledgeBaseId),
      };
    }

    const pipeline = [
      {
        $vectorSearch: vectorSearchStage,
      },
      {
        $project: {
          _id: 1,
          documentId: 1,
          knowledgeBaseId: 1,
          index: 1,
          text: 1,
          charStart: 1,
          charEnd: 1,
          score: { $meta: 'searchScore' },
        },
      },
    ];

    try {
      const results = await DocumentChunkModel.aggregate(pipeline);
      return results.map((r: any) => ({
        chunkId: r._id.toString(),
        documentId: r.documentId.toString(),
        knowledgeBaseId: r.knowledgeBaseId.toString(),
        index: r.index,
        text: r.text,
        charStart: r.charStart,
        charEnd: r.charEnd,
        score: r.score,
      }));
    } catch (err: any) {
      // Safeguard for local development without Atlas Search configuration
      const isAtlasUnavailable =
        err.message?.includes('$vectorSearch') ||
        err.message?.includes('SearchIndexRequirement') ||
        err.codeName === 'CommandNotFound' ||
        err.message?.includes('unsupported aggregate stage');

      if (isAtlasUnavailable) {
        console.warn(
          `[MongoVectorStoreProvider] MongoDB Atlas Vector Search index failed (likely running local MongoDB instance): ${err.message}. Returning empty results.`
        );
        return [];
      }
      throw err;
    }
  }
}
