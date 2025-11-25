import type { Content,Root } from 'mdast';
import type { Array as YArray, Map as YMap, Text as YText } from 'yjs';

// Re-export MDAST types for convenience
export type { Content,Root } from 'mdast';
export type MarkdownAST = Root | Content;

/**
 * BlockSuite block snapshot structure
 * Matches the structure from @blocksuite/store
 */
export interface BlockSnapshot {
  type: 'block';
  id: string;
  flavour: string;
  props: Record<string, any>;
  children: BlockSnapshot[];
}

/**
 * Context passed to adapter functions during AST traversal
 */
export interface AdapterContext {
  // Current parent block being built
  parent: BlockSnapshot;
  // Configuration/metadata
  configs?: Map<string, any>;
  // Text buffer for accumulating inline content
  textBuffer: { content: string };
}

/**
 * Block adapter interface
 * Each markdown node type has an adapter that converts it to BlockSuite format
 */
export interface BlockAdapter {
  // Check if this adapter handles the given markdown node
  match: (node: MarkdownAST) => boolean;

  // Enter handler - called when entering the node during traversal
  enter?: (node: MarkdownAST, context: AdapterContext) => void | Promise<void>;

  // Leave handler - called when leaving the node during traversal
  leave?: (node: MarkdownAST, context: AdapterContext) => void | Promise<void>;
}

/**
 * Yjs block representation
 * What we construct in the YDoc
 */
export interface YBlock {
  map: YMap<any>;
  id: string;
  flavour: string;
}
