// ============================================================
// DocxParser — extracts plain text from DOCX files using mammoth
// ============================================================
import path from 'path';
import type { DocumentParser } from './types';
import type { DocumentFileType } from '../types';

const PARSER_VERSION = 'mammoth@1.x';

export class DocxParser implements DocumentParser {
  readonly fileTypes: DocumentFileType[] = ['docx'];
  readonly version = PARSER_VERSION;

  async extractText(absolutePath: string): Promise<string> {
    const ext = path.extname(absolutePath).toLowerCase();
    if (ext !== '.docx') {
      throw new Error(`DocxParser: expected .docx, got "${ext}"`);
    }
    // Dynamic import keeps startup bundle lean
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ path: absolutePath });
    return result.value ?? '';
  }
}
