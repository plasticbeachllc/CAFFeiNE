import test from 'ava';
import { applyUpdate, Doc as YDoc,encodeStateAsUpdate } from 'yjs';

import { markdownToYDoc } from '../../core/markdown-parser/index.ts';

test('should create a valid YDoc', async t => {
  const markdown = '# Hello World';
  const doc = await markdownToYDoc(markdown, 'Test Doc');

  t.true(doc instanceof YDoc);

  const meta = doc.getMap('meta');
  t.is(meta.get('title'), 'Test Doc');
  t.truthy(meta.get('id'));
});

test('should parse headings correctly', async t => {
  const markdown = `# Heading 1
## Heading 2
### Heading 3`;

  const doc = await markdownToYDoc(markdown, 'Headings Test');
  const blocks = doc.getMap('blocks');

  const allBlocks = Array.from(blocks.values());
  const paragraphs = allBlocks.filter(
    (block: any) => block.get('sys:flavour') === 'affine:paragraph'
  );

  t.true(
    paragraphs.length >= 3,
    `Expected at least 3 paragraphs, got ${paragraphs.length}`
  );

  const h1 = paragraphs.find((p: any) => p.get('prop:type') === 'h1');
  const h2 = paragraphs.find((p: any) => p.get('prop:type') === 'h2');
  const h3 = paragraphs.find((p: any) => p.get('prop:type') === 'h3');

  t.truthy(h1, 'h1 heading not found');
  t.truthy(h2, 'h2 heading not found');
  t.truthy(h3, 'h3 heading not found');
});

test('should parse bulleted lists', async t => {
  const markdown = `- Item 1
- Item 2
- Item 3`;

  const doc = await markdownToYDoc(markdown, 'List Test');
  const blocks = doc.getMap('blocks');

  const allBlocks = Array.from(blocks.values());
  const lists = allBlocks.filter(
    (block: any) => block.get('sys:flavour') === 'affine:list'
  );

  t.is(lists.length, 3, `Expected 3 list items, got ${lists.length}`);

  lists.forEach((list: any) => {
    t.is(list.get('prop:type'), 'bulleted');
  });
});

test('should parse code blocks', async t => {
  const markdown = '```typescript\nconst x = 1;\n```';

  const doc = await markdownToYDoc(markdown, 'Code Test');
  const blocks = doc.getMap('blocks');

  const allBlocks = Array.from(blocks.values());
  const codeBlocks = allBlocks.filter(
    (block: any) => block.get('sys:flavour') === 'affine:code'
  );

  t.is(codeBlocks.length, 1);
  t.is(codeBlocks[0].get('prop:language'), 'typescript');
});

test('should be binary-compatible', async t => {
  const markdown = '# Test';
  const doc = await markdownToYDoc(markdown, 'Binary Test');

  const update = encodeStateAsUpdate(doc);
  t.true(update instanceof Uint8Array);

  const newDoc = new YDoc();
  applyUpdate(newDoc, update);

  const meta = newDoc.getMap('meta');
  t.is(meta.get('title'), 'Binary Test');
});
