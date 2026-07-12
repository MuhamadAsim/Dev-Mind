// ============================================================
// PdfParser — extracts text from PDF files using pdf-parse v2
// ============================================================
import path from 'path';
import fs from 'fs/promises';
import { PDFParse } from 'pdf-parse';
import type { DocumentParser } from './types';
import type { DocumentFileType } from '../types';

const PARSER_VERSION = 'pdf-parse@2.x';

export class PdfParser implements DocumentParser {
  readonly fileTypes: DocumentFileType[] = ['pdf'];
  readonly version = PARSER_VERSION;

  async extractText(absolutePath: string): Promise<string> {
    const ext = path.extname(absolutePath).toLowerCase();
    if (ext !== '.pdf') {
      throw new Error(`PdfParser: expected .pdf, got "${ext}"`);
    }

    const buffer = await fs.readFile(absolutePath);
    const parser = new PDFParse({ data: buffer });

    try {
      const result = await parser.getText();
      return result.text ?? '';
    } finally {
      // v2 wraps pdfjs-dist workers — always release them or you'll leak
      await parser.destroy();
    }
  }
}