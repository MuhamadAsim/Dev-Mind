// ============================================================
// StorageProvider — abstract interface for file storage
//
// Phase 8 ships a LocalStorageProvider only.
// Future: implement S3StorageProvider, GCSStorageProvider, etc.
// by implementing this interface and swapping the singleton
// in storage/index.ts — no other code changes required.
// ============================================================

export interface StorageProvider {
  /**
   * Save a binary file (e.g. an uploaded PDF/DOCX).
   *
   * @param namespace  - Logical grouping, typically the Knowledge Base ID
   * @param filename   - The filename to store the data under
   * @param data       - Raw binary buffer of the file
   * @returns Relative storage path and actual size in bytes
   */
  saveFile(
    namespace: string,
    filename: string,
    data: Buffer
  ): Promise<{ path: string; sizeBytes: number }>;

  /**
   * Save a UTF-8 text file (e.g. extracted document text).
   *
   * @param namespace  - Logical grouping, typically the Knowledge Base ID
   * @param filename   - The filename to store the text under
   * @param text       - The text content to write
   * @returns Relative storage path
   */
  saveText(
    namespace: string,
    filename: string,
    text: string
  ): Promise<{ path: string }>;

  /**
   * Read a stored text file back as a UTF-8 string.
   *
   * @param path - The relative path returned by saveFile / saveText
   */
  readText(path: string): Promise<string>;

  /**
   * Delete a single file.
   *
   * @param path - The relative path returned by saveFile / saveText
   */
  deleteFile(path: string): Promise<void>;

  /**
   * Delete an entire namespace (directory) and all files within it.
   * Used when deleting a Knowledge Base.
   *
   * @param namespace - The namespace to delete (e.g. Knowledge Base ID)
   */
  deleteNamespace(namespace: string): Promise<void>;
}
