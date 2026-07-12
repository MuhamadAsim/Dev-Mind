// ============================================================
// LocalStorageProvider — filesystem implementation of StorageProvider
//
// Directory layout:
//   <STORAGE_ROOT>/uploads/<namespace>/<filename>   — original files
//   <STORAGE_ROOT>/extracted/<namespace>/<filename> — extracted text
//
// STORAGE_ROOT defaults to "storage" (project root relative).
// Set STORAGE_ROOT in .env.local to change it.
// ============================================================
import fs from 'fs/promises';
import path from 'path';
import type { StorageProvider } from './storageProvider';

function getStorageRoot(): string {
  return process.env.STORAGE_ROOT ?? 'storage';
}

export class LocalStorageProvider implements StorageProvider {
  private uploadsDir(namespace: string): string {
    return path.join(getStorageRoot(), 'uploads', namespace);
  }

  private extractedDir(namespace: string): string {
    return path.join(getStorageRoot(), 'extracted', namespace);
  }

  async saveFile(
    namespace: string,
    filename: string,
    data: Buffer
  ): Promise<{ path: string; sizeBytes: number }> {
    const dir = this.uploadsDir(namespace);
    await fs.mkdir(dir, { recursive: true });

    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, data);

    // Normalise to forward-slash relative path for cross-platform consistency
    const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    return { path: relativePath, sizeBytes: data.byteLength };
  }

  async saveText(
    namespace: string,
    filename: string,
    text: string
  ): Promise<{ path: string }> {
    const dir = this.extractedDir(namespace);
    await fs.mkdir(dir, { recursive: true });

    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, text, 'utf-8');

    const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    return { path: relativePath };
  }

  async readText(relativePath: string): Promise<string> {
    const filePath = path.resolve(process.cwd(), relativePath);
    return fs.readFile(filePath, 'utf-8');
  }

  async deleteFile(relativePath: string): Promise<void> {
    try {
      const filePath = path.resolve(process.cwd(), relativePath);
      await fs.unlink(filePath);
    } catch (err: unknown) {
      // Ignore "file not found" — deletion is idempotent
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  async deleteNamespace(namespace: string): Promise<void> {
    const uploadDir = this.uploadsDir(namespace);
    const extractedDir = this.extractedDir(namespace);

    await Promise.allSettled([
      fs.rm(uploadDir, { recursive: true, force: true }),
      fs.rm(extractedDir, { recursive: true, force: true }),
    ]);
  }
}
