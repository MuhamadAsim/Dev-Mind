// ============================================================
// DocumentParser — interface for file-type-specific text extractors
//
// To add a new parser (e.g. XLSX, PPTX):
//   1. Create parsers/xlsxParser.ts implementing DocumentParser
//   2. Register it in parsers/parserRegistry.ts
//   No other code changes required.
// ============================================================
import type { DocumentFileType } from '../types';

export interface DocumentParser {
  /** File types this parser handles */
  readonly fileTypes: DocumentFileType[];
  /**
   * Human-readable version string, e.g. "pdf-parse@1.1.1".
   * Stored in the KbDocument.parserVersion field so you can
   * detect when a document should be re-processed after a
   * parser upgrade.
   */
  readonly version: string;
  /**
   * Read the file at `absolutePath` and return the full
   * extracted text as a UTF-8 string.
   */
  extractText(absolutePath: string): Promise<string>;
}
