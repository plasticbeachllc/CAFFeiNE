import type { Heading, Paragraph, Text } from 'mdast';
import { nanoid } from 'nanoid';

import type { AdapterContext, BlockAdapter, MarkdownAST } from '../types';

/**
 * Paragraph adapter
 * Handles: paragraphs, headings (h1-h6)
 * Ported from blocksuite/affine/blocks/paragraph/src/adapters/markdown.ts
 */
export const paragraphAdapter: BlockAdapter = {
  match: (node: MarkdownAST) => {
    return node.type === 'paragraph' || node.type === 'heading';
  },

  enter: (node: MarkdownAST, context: AdapterContext) => {
    // Reset text buffer
    context.textBuffer.content = '';
  },

  leave: (node: MarkdownAST, context: AdapterContext) => {
    const isParagraph = node.type === 'paragraph';
    const isHeading = node.type === 'heading';

    if (!isParagraph && !isHeading) return;

    // Get text content
    const text = context.textBuffer.content;
    if (!text) return;

    // Determine paragraph type
    let type = 'text';
    if (isHeading) {
      const heading = node as Heading;
      type = `h${heading.depth}`; // h1, h2, h3, etc.
    }

    // Create block
    const block = {
      type: 'block' as const,
      id: nanoid(),
      flavour: 'affine:paragraph',
      props: {
        type,
        text: {
          '$blocksuite:internal:text$': true,
          delta: [{ insert: text }],
        },
      },
      children: [],
    };

    context.parent.children.push(block);
    context.textBuffer.content = '';
  },
};

/**
 * Text adapter
 * Accumulates text content into the buffer
 */
export const textAdapter: BlockAdapter = {
  match: (node: MarkdownAST) => {
    return node.type === 'text';
  },

  enter: (node: MarkdownAST, context: AdapterContext) => {
    const textNode = node as Text;
    context.textBuffer.content += textNode.value;
  },
};
