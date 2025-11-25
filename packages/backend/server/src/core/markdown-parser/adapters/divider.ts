import type { ThematicBreak } from 'mdast';
import { nanoid } from 'nanoid';

import type { AdapterContext, BlockAdapter, MarkdownAST } from '../types';

/**
 * Divider adapter
 * Handles horizontal rules (---, ***, ___)
 * Ported from blocksuite/affine/blocks/divider/src/adapters/markdown.ts
 */
export const dividerAdapter: BlockAdapter = {
  match: (node: MarkdownAST) => {
    return node.type === 'thematicBreak';
  },

  leave: (node: MarkdownAST, context: AdapterContext) => {
    const block = {
      type: 'block' as const,
      id: nanoid(),
      flavour: 'affine:divider',
      props: {},
      children: [],
    };

    context.parent.children.push(block);
  },
};
