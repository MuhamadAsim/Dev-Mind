// ============================================================
// PdfParser — extracts text from PDF files using pdf-parse
// ============================================================
import path from 'path';
import fs from 'fs/promises';
import type { DocumentParser } from './types';
import type { DocumentFileType } from '../types';

// pdf-parse version — keep in sync with package.json
const PARSER_VERSION = 'pdf-parse@1.1.1';

export class PdfParser implements DocumentParser {
  readonly fileTypes: DocumentFileType[] = ['pdf'];
  readonly version = PARSER_VERSION;

  async extractText(absolutePath: string): Promise<string> {
    // Dynamic import avoids loading the heavy pdf-parse module at startup.
    // pdf-parse has no ESM export so we use require() via dynamic import.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfImport = (await import('pdf-parse')) as any;
    const pdfParse = pdfImport.default || pdfImport;
    const ext = path.extname(absolutePath).toLowerCase();
    if (ext !== '.pdf') {
      throw new Error(`PdfParser: expected .pdf, got "${ext}"`);
    }
    const buffer = await fs.readFile(absolutePath);
    const result = await pdfParse(buffer);
    return result.text ?? '';
  }
}
