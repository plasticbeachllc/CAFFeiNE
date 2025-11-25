import { encodeStateAsUpdate } from 'yjs';

import { markdownToYDoc } from '../markdown-parser/index.js';

const markdown = `
# Test Document

This is a paragraph.

## Features

- Item 1
- Item 2
- Item 3

\`\`\`typescript
const x = 1;
\`\`\`

---

Done!
`.trim();

console.log('🧪 Testing Markdown Parser...\n');

const doc = await markdownToYDoc(markdown, 'Test Parser');
const blocks = doc.getMap('blocks');
const meta = doc.getMap('meta');

console.log('✅ Meta:');
console.log(`  - Title: ${meta.get('title')}`);
console.log(`  - ID: ${meta.get('id')}`);

console.log('\n✅ Blocks:');
const allBlocks = Array.from(blocks.values());
const blocksByFlavour = {};

allBlocks.forEach((block: any) => {
  const flavour = block.get('sys:flavour');
  blocksByFlavour[flavour] = (blocksByFlavour[flavour] || 0) + 1;
});

Object.entries(blocksByFlavour).forEach(([flavour, count]) => {
  console.log(`  - ${flavour}: ${count}`);
});

console.log('\n✅ Binary Encoding:');
const update = encodeStateAsUpdate(doc);
console.log(`  - Size: ${update.length} bytes`);

console.log('\n🎉 Parser working correctly!');
