import type { Content,Root } from 'mdast';
import { nanoid } from 'nanoid';

import type {
  AdapterContext,
  BlockAdapter,
  BlockSnapshot,
  MarkdownAST,
} from './types';

/**
 * AST Walker - traverses the Markdown AST and converts to BlockSuite structure
 * Ported from BlockSuite's ASTWalker pattern
 */
export class ASTWalker {
  private readonly adapters: BlockAdapter[];

  constructor(adapters: BlockAdapter[]) {
    this.adapters = adapters;
  }

  /**
   * Walk the markdown AST and build BlockSuite snapshot
   */
  async walk(ast: Root): Promise<BlockSnapshot> {
    // Create root note block (container for all content)
    const rootBlock: BlockSnapshot = {
      type: 'block',
      id: nanoid(),
      flavour: 'affine:note',
      props: {
        xywh: '[0,0,800,95]',
        background: '--affine-note-background-blue',
        index: 'a0',
        hidden: false,
        displayMode: 'both', // Both page and edgeless mode
      },
      children: [],
    };

    const context: AdapterContext = {
      parent: rootBlock,
      textBuffer: { content: '' },
    };

    // Process all children of the root
    for (const child of ast.children) {
      await this.processNode(child, context);
    }

    return rootBlock;
  }

  /**
   * Process a single markdown node
   */
  private async processNode(
    node: MarkdownAST,
    context: AdapterContext
  ): Promise<void> {
    // Find matching adapter
    const adapter = this.adapters.find(a => a.match(node));

    if (!adapter) {
      // No adapter found - try to process children if they exist
      if ('children' in node && Array.isArray(node.children)) {
        for (const child of node.children) {
          await this.processNode(child, context);
        }
      }
      return;
    }

    // Call enter handler
    if (adapter.enter) {
      await adapter.enter(node, context);
    }

    // Process children if they exist
    if ('children' in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        await this.processNode(child, context);
      }
    }

    // Call leave handler
    if (adapter.leave) {
      await adapter.leave(node, context);
    }
  }
}
