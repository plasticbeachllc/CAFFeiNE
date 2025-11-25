import { nanoid } from 'nanoid';
import { Array as YArray,Doc as YDoc, Map as YMap, Text as YText } from 'yjs';

export async function markdownToYDoc(
  title: string,
  markdown: string
): Promise<YDoc> {
  const doc = new YDoc();
  const blocks = doc.getMap('blocks');

  // Create Root Page Block
  const pageId = nanoid();
  const pageBlock = new YMap();
  pageBlock.set('sys:id', pageId);
  pageBlock.set('sys:flavour', 'affine:page');
  pageBlock.set('prop:title', new YText(title));
  const pageChildren = new YArray();
  pageBlock.set('sys:children', pageChildren);

  blocks.set(pageId, pageBlock);

  // Add Page to Meta
  const meta = doc.getMap('meta');
  meta.set('id', pageId);
  meta.set('title', title);
  meta.set('createDate', Date.now());

  // Parse Markdown (Enhanced)
  const lines = markdown.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const blockId = nanoid();
    const block = new YMap();
    block.set('sys:id', blockId);

    if (trimmed.startsWith('# ')) {
      block.set('sys:flavour', 'affine:paragraph');
      block.set('prop:text', new YText(trimmed.substring(2)));
      block.set('prop:type', 'h1');
    } else if (trimmed.startsWith('## ')) {
      block.set('sys:flavour', 'affine:paragraph');
      block.set('prop:text', new YText(trimmed.substring(3)));
      block.set('prop:type', 'h2');
    } else if (trimmed.startsWith('### ')) {
      block.set('sys:flavour', 'affine:paragraph');
      block.set('prop:text', new YText(trimmed.substring(4)));
      block.set('prop:type', 'h3');
    } else if (trimmed.startsWith('- ')) {
      block.set('sys:flavour', 'affine:list');
      block.set('prop:text', new YText(trimmed.substring(2)));
      block.set('prop:type', 'bulleted');
    } else if (trimmed.startsWith('```')) {
      // Simple code block handling (single line for now)
      block.set('sys:flavour', 'affine:code');
      block.set('prop:text', new YText(trimmed.replace(/```/g, '')));
      block.set('prop:language', 'plaintext');
    } else {
      block.set('sys:flavour', 'affine:paragraph');
      block.set('prop:text', new YText(trimmed));
      block.set('prop:type', 'text');
    }

    blocks.set(blockId, block);
    pageChildren.push([blockId]);
  }

  return doc;
}
