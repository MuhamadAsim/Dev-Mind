// ============================================================
// TextParser — reads plain text and Markdown files directly
// No third-party library needed — fs.readFile suffices.
// ============================================================
import fs from 'fs/promises';
import path from 'path';
import type { DocumentParser } from './types';
import type { DocumentFileType } from '../types';

const PARSER_VERSION = 'text-parser@1.0.0';

export class TextParser implements DocumentParser {
  readonly fileTypes: DocumentFileType[] = ['txt', 'md'];
  readonly version = PARSER_VERSION;

  async extractText(absolutePath: string): Promise<string> {
    const ext = path.extname(absolutePath).toLowerCase();
    if (ext !== '.txt' && ext !== '.md') {
      throw new Error(`TextParser: expected .txt or .md, got "${ext}"`);
    }
    return fs.readFile(absolutePath, 'utf-8');
  }
}
