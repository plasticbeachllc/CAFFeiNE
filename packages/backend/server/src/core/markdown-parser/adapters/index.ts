import type { BlockAdapter } from '../types.ts';
import { codeAdapter } from './code.ts';
import { dividerAdapter } from './divider.ts';
import { listAdapter } from './list.ts';
import { paragraphAdapter, textAdapter } from './paragraph.ts';

/**
 * Registry of all block adapters
 * Order matters - more specific adapters should come first
 */
export const allAdapters: BlockAdapter[] = [
  listAdapter, // Must come before paragraph (list items contain paragraphs)
  codeAdapter,
  dividerAdapter,
  paragraphAdapter,
  textAdapter,
  // More adapters will be added here (blockquote, image, table, etc.)
];
