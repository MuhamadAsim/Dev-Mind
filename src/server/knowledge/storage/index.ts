// ============================================================
// Storage singleton export
//
// To switch to a different storage provider (e.g. S3):
//   1. Implement S3StorageProvider extends StorageProvider
//   2. Change the import below — nothing else needs to change
// ============================================================
import { LocalStorageProvider } from './localStorageProvider';
import type { StorageProvider } from './storageProvider';

export const storageProvider: StorageProvider = new LocalStorageProvider();
export type { StorageProvider };
