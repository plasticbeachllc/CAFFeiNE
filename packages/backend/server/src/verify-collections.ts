import './prelude';

import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import * as Y from 'yjs';

async function verifyCollections() {
  // Dynamic import to ensure prelude runs first
  const { AppModule } = await import('./app.module');
  const { Models } = await import('./models'); // Import Models class for type/token

  const app = await NestFactory.createApplicationContext(AppModule);
  const models = app.get(Models);
  const db = app.get(PrismaClient);

  const workspaceId = 'test-workspace-id-12345'; // The ID we used

  console.log(`Checking workspace: ${workspaceId}`);

  // 1. Check WorkspaceDoc metadata using Prisma
  const docs = await db.workspaceDoc.findMany({
    where: { workspaceId },
  });
  console.log(
    'Workspace Documents:',
    docs.map(d => ({ id: d.docId, title: d.title }))
  );

  // 2. Check Collections in space:meta
  // We use models.doc.get to fetch the snapshot
  const snapshot = await models.doc.get(workspaceId, workspaceId);
  if (!snapshot) {
    console.log('Root doc (space:meta) not found!');
    await app.close();
    return;
  }

  const doc = new Y.Doc();
  Y.applyUpdate(doc, snapshot.blob);

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

  await app.close();
}

verifyCollections().catch(console.error);
