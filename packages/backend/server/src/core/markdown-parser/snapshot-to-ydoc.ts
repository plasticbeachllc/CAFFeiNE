import { nanoid } from 'nanoid';
import { Array as YArray,Doc as YDoc, Map as YMap, Text as YText } from 'yjs';

import type { BlockSnapshot } from './types';

/**
 * Convert BlockSuite snapshot to Yjs YDoc
 * This is the final step that creates the binary-compatible YDoc
 */
export function snapshotToYDoc(snapshot: BlockSnapshot, title: string): YDoc {
  const doc = new YDoc();
  const blocks = doc.getMap('blocks');
  const meta = doc.getMap('meta');

  // Create page block
  const pageId = nanoid();
  const pageBlock = new YMap();
  pageBlock.set('sys:id', pageId);
  pageBlock.set('sys:flavour', 'affine:page');

  // Set page title
  pageBlock.set('prop:title', new YText(title));

  const pageChildren = new YArray();
  pageBlock.set('sys:children', pageChildren);
  blocks.set(pageId, pageBlock);

  // Set metadata
  meta.set('id', pageId);
  meta.set('title', title);
  meta.set('createDate', Date.now());

  // Create note block
  const noteId = nanoid();
  const noteBlock = new YMap();
  noteBlock.set('sys:id', noteId);
  noteBlock.set('sys:flavour', 'affine:note');
  noteBlock.set('prop:displayMode', 'both');
  noteBlock.set('sys:children', new YArray());
  blocks.set(noteId, noteBlock);

  // Add note to page children
  const integratedPageBlock = blocks.get(pageId) as YMap<any>;
  const integratedPageChildren = integratedPageBlock.get(
    'sys:children'
  ) as YArray<string>;
  integratedPageChildren.push([noteId]);

  // Convert snapshot children to YDoc blocks, adding them to the note
  const integratedNoteBlock = blocks.get(noteId) as YMap<any>;
  const integratedNoteChildren = integratedNoteBlock.get(
    'sys:children'
  ) as YArray<string>;
  convertBlockSnapshot(blocks, integratedNoteChildren, snapshot);

  return doc;
}

/**
 * Recursively convert snapshot blocks to Yjs structures
 */
function convertBlockSnapshot(
  blocksMap: YMap<any>,
  parentChildren: YArray<string>,
  snapshot: BlockSnapshot
): void {
  // Process each child in the snapshot
  for (const child of snapshot.children) {
    const block = new YMap();
    block.set('sys:id', child.id);
    block.set('sys:flavour', child.flavour);

    // Add to blocks map immediately to ensure it's part of the doc
    blocksMap.set(child.id, block);
    const integratedBlock = blocksMap.get(child.id) as YMap<any>;

    // Set props on the integrated block
    for (const [key, value] of Object.entries(child.props)) {
      if (key === 'text' && isTextProp(value)) {
        // Handle text delta format
        const yText = new YText();
        try {
          integratedBlock.set(`prop:${key}`, yText);
        } catch (e) {
          throw e;
        }

        const integratedText = integratedBlock.get(`prop:${key}`) as YText;

        if (value.delta && Array.isArray(value.delta)) {
          for (const op of value.delta) {
            if (op.insert) {
              try {
                integratedText.insert(
                  integratedText.length,
                  op.insert,
                  op.attributes
                );
              } catch (e) {
                throw e;
              }
            }
          }
        }
      } else {
        try {
          console.log(`Setting prop ${key} on integrated block`);
          integratedBlock.set(`prop:${key}`, value);
        } catch (e) {
          console.error(`Error setting prop ${key}:`, e);
          throw e;
        }
      }
    }

    // Add to parent's children
    parentChildren.push([child.id]);

    // Process grandchildren
    if (child.children.length > 0) {
      const childChildren = new YArray<string>();
      integratedBlock.set('sys:children', childChildren);
      const integratedChildChildren = integratedBlock.get(
        'sys:children'
      ) as YArray<string>;
      convertBlockSnapshot(blocksMap, integratedChildChildren, child);
    }
  }
}

function isTextProp(
  value: any
): value is { '$blocksuite:internal:text$': true; delta: any[] } {
  return (
    value &&
    typeof value === 'object' &&
    value['$blocksuite:internal:text$'] === true
  );
}
