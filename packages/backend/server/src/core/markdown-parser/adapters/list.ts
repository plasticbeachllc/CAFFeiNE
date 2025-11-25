import type { List } from 'mdast';
import { nanoid } from 'nanoid';

import type { AdapterContext, BlockAdapter, MarkdownAST } from '../types';

/**
 * List adapter
 * Handles: bulleted lists, numbered lists, todo lists
 * Ported from blocksuite/affine/blocks/list/src/adapters/markdown.ts
 */
export const listAdapter: BlockAdapter = {
  match: (node: MarkdownAST) => {
    return node.type === 'list';
  },

  enter: (node: MarkdownAST, context: AdapterContext) => {
    const list = node as List;

    // Determine list type
    let listType: 'bulleted' | 'numbered' | 'todo' = 'bulleted';
    if (list.ordered) {
      listType = 'numbered';
    }

    // Process each list item
    if (list.children) {
      for (const item of list.children) {
        if (item.type !== 'listItem') continue;

        // Check for todo checkbox
        const isTodo = item.checked !== null && item.checked !== undefined;
        if (isTodo) {
          listType = 'todo';
        }

        // Get text content from list item
        let text = '';
        if (item.children) {
          for (const child of item.children) {
            if (child.type === 'paragraph' && 'children' in child) {
              for (const textNode of child.children) {
                if (textNode.type === 'text') {
                  text += textNode.value;
                }
              }
            }
          }
        }

        // Create list block
        const block = {
          type: 'block' as const,
          id: nanoid(),
          flavour: 'affine:list',
          props: {
            type: listType,
            text: {
              '$blocksuite:internal:text$': true,
              delta: [{ insert: text }],
            },
            checked: isTodo ? item.checked || false : false,
          },
          children: [],
        };

        context.parent.children.push(block);
      }
    }
  },
};
