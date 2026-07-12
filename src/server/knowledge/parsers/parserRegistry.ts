// ============================================================
// Parser Registry
//
// Maps DocumentFileType → DocumentParser.
// To add a new parser:
//   1. Create parsers/<format>Parser.ts
//   2. Instantiate it here and add its fileTypes to the map.
//   Nothing else in the system needs to change.
// ============================================================
import { PdfParser } from './pdfParser';
import { DocxParser } from './docxParser';
import { TextParser } from './textParser';
import type { DocumentParser } from './types';
import type { DocumentFileType } from '../types';

// ── Parser instances ──────────────────────────────────────────
// One instance per parser type — they are stateless so sharing is safe.
const parsers: DocumentParser[] = [
  new PdfParser(),
  new DocxParser(),
  new TextParser(),
];

// Build the lookup map from the parsers' own fileTypes declarations.
// This means adding a new parser never requires editing this map manually.
const registry = new Map<DocumentFileType, DocumentParser>();
for (const parser of parsers) {
  for (const type of parser.fileTypes) {
    registry.set(type, parser);
  }
}

// ── Public API ────────────────────────────────────────────────

/**
 * Return the parser for the given file type.
 * Throws if the type is not supported — callers should validate
 * with `getSupportedTypes()` before calling this.
 */
export function getParser(fileType: DocumentFileType): DocumentParser {
  const parser = registry.get(fileType);
  if (!parser) {
    throw new Error(`No parser registered for file type "${fileType}"`);
  }
  return parser;
}

/**
 * List all file types that have a registered parser.
 * Used by upload validation and UI accept-list generation.
 */
export function getSupportedTypes(): DocumentFileType[] {
  return Array.from(registry.keys());
}
