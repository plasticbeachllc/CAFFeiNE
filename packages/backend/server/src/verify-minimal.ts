import './prelude';

import { PrismaClient } from '@prisma/client';
import * as Y from 'yjs';

async function verifyMinimal() {
  const db = new PrismaClient();
  const workspaceId = 'test-workspace-id-12345';

  console.log(`Checking workspace: ${workspaceId}`);

  try {
    // 1. Check WorkspaceDoc metadata
    const docs = await db.workspaceDoc.findMany({
      where: { workspaceId },
    });
    console.log(
      'Workspace Documents:',
      docs.map(d => ({ id: d.docId, title: d.title }))
    );

    // 2. Check Collections in space:meta
    // We need to fetch snapshot AND updates to get the full state

    const snapshot = (await db.$queryRaw`
      SELECT blob FROM snapshots 
      WHERE workspace_id = ${workspaceId} AND guid = ${workspaceId}
      ORDER BY updated_at DESC
      LIMIT 1
    `) as any[];

    const updates = (await db.$queryRaw`
      SELECT blob FROM updates
      WHERE workspace_id = ${workspaceId} AND guid = ${workspaceId}
      ORDER BY created_at ASC
    `) as any[];

    const doc = new Y.Doc();

    if (snapshot && snapshot.length > 0) {
      Y.applyUpdate(doc, snapshot[0].blob);
    }

    if (updates && updates.length > 0) {
      console.log(`Applying ${updates.length} updates...`);
      updates.forEach(u => Y.applyUpdate(doc, u.blob));
    }

    const settingMap = doc.getMap('setting');
    const collectionsArray = settingMap.get('collections') as Y.Array<any>;

    if (!collectionsArray) {
      console.log('No collections found in space:meta');
    } else {
      console.log(`Collections found: ${collectionsArray.length}`);
      collectionsArray.forEach((collection, index) => {
        console.log(`Collection ${index + 1}:`);
        console.log(JSON.stringify(collection, null, 2));
      });
    }

    // Check meta.pages
    const metaMap = doc.getMap('meta');
    const pagesArray = metaMap.get('pages') as Y.Array<any>;

    if (!pagesArray) {
      console.log('No pages metadata found in space:meta (meta.pages)');
    } else {
      console.log(`Pages metadata found: ${pagesArray.length}`);
      pagesArray.forEach((page, index) => {
        console.log(`Page Meta ${index + 1}:`);
        console.log(JSON.stringify(page, null, 2));
      });
    }
  } catch (error) {
    console.error('Verification failed:', error);
  } finally {
    await db.$disconnect();
  }
}

verifyMinimal().catch(console.error);
