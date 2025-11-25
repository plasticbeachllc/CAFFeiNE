import { Doc as YDoc } from 'yjs';

import { allAdapters } from './adapters/index';
import { ASTWalker } from './ast-walker';
import { MarkdownParser } from './parser';
import { snapshotToYDoc } from './snapshot-to-ydoc';

/**
 * Main entry point for markdown to YDoc conversion
 *
 * @param markdown - Markdown string to convert
 * @param title - Document title
 * @returns YDoc compatible with BlockSuite/AFFiNE frontend
 */
export async function markdownToYDoc(
  markdown: string,
  title: string
): Promise<YDoc> {
  // 1. Parse markdown to AST
  const parser = new MarkdownParser();
  const ast = parser.parse(markdown);

  // 2. Convert AST to BlockSuite Snapshot
  const walker = new ASTWalker(allAdapters);
  const snapshot = await walker.walk(ast);

  // 3. Convert Snapshot to YDoc
  const doc = snapshotToYDoc(snapshot, title);

  return doc;
}

// Re-export for convenience
export { ASTWalker } from './ast-walker';
export { MarkdownParser } from './parser';
export * from './types';
