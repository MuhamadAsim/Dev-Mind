// ============================================================
// Vector store singleton export
//
// To switch to a different vector store provider (e.g. Pinecone):
//   1. Implement PineconeVectorStoreProvider extends VectorStoreProvider
//   2. Change the import below — nothing else needs to change
// ============================================================
import { MongoVectorStoreProvider } from './mongoVectorStoreProvider';
import type { VectorStoreProvider } from './vectorStoreProvider';

export const vectorStoreProvider: VectorStoreProvider = new MongoVectorStoreProvider();
export type { VectorStoreProvider };
