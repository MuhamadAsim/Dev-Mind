// ============================================================
// MongoDB Connection Singleton
// Caches the Mongoose connection so Next.js hot reloads
// in development don't open hundreds of parallel connections.
// In production there is only one connection per serverless instance.
// ============================================================
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

// Module-level cache — persists across hot reloads in dev
interface ConnectionCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Use a global to avoid re-declaring across module reloads
const globalWithCache = global as typeof global & { _mongooseCache?: ConnectionCache };
if (!globalWithCache._mongooseCache) {
  globalWithCache._mongooseCache = { conn: null, promise: null };
}
const cache = globalWithCache._mongooseCache;

export async function connectDB(): Promise<typeof mongoose> {
  // Already connected
  if (cache.conn) return cache.conn;

  if (!MONGODB_URI) {
    throw new Error('Missing MONGODB_URI environment variable. Add it to .env.local.');
  }

  // Connection in progress — reuse the same promise
  if (!cache.promise) {
    cache.promise = mongoose
      .connect(MONGODB_URI as string, {
        bufferCommands: false,
      })
      .then((m) => {
        console.log('[MongoDB] Connected');
        return m;
      });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
