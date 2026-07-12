// ============================================================
// VectorStoreProvider — abstract interface for vector database operations
//
// Decouples the Vector Search logic from MongoDB Atlas specifically,
// allowing us to swap it with Pinecone, Qdrant, PGVector, etc.
// ============================================================

export interface VectorStoreChunk {
  chunkId: string;
  documentId: string;
  knowledgeBaseId: string;
  /** Zero-based order index of this chunk within the document */
  index: number;
  text: string;
  charStart: number;
  charEnd: number;
  score?: number; // Similarity search confidence / cosine similarity score
}

export interface VectorStoreChunkInput extends Omit<VectorStoreChunk, 'score'> {
  embedding: number[];
}

export interface VectorStoreProvider {
  /**
   * Save (upsert/insert) document chunks with their embeddings.
   */
  saveChunks(chunks: VectorStoreChunkInput[]): Promise<void>;

  /**
   * Delete all chunks associated with a specific Document ID.
   */
  deleteChunksByDocument(documentId: string): Promise<void>;

  /**
   * Delete all chunks associated with a specific Knowledge Base ID.
   */
  deleteChunksByKnowledgeBase(knowledgeBaseId: string): Promise<void>;

  /**
   * Perform vector search matching the queryVector, optionally scoped to a knowledgeBaseId.
   */
  similaritySearch(
    queryVector: number[],
    options: {
      knowledgeBaseId?: string;
      limit?: number;
    }
  ): Promise<VectorStoreChunk[]>;
}
