import type { Code } from 'mdast';
import { nanoid } from 'nanoid';

import type { AdapterContext, BlockAdapter, MarkdownAST } from '../types';

/**
 * Code block adapter
 * Handles fenced code blocks with language detection
 * Ported from blocksuite/affine/blocks/code/src/adapters/markdown.ts
 */
export const codeAdapter: BlockAdapter = {
  match: (node: MarkdownAST) => {
    return node.type === 'code';
  },

  leave: (node: MarkdownAST, context: AdapterContext) => {
    const code = node as Code;

    const block = {
      type: 'block' as const,
      id: nanoid(),
      flavour: 'affine:code',
      props: {
        language: code.lang || 'plaintext',
        text: {
          '$blocksuite:internal:text$': true,
          delta: [{ insert: code.value }],
        },
      },
      children: [],
    };

    context.parent.children.push(block);
  },
};
