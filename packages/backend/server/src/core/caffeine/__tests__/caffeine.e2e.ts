import { Workspace } from '@prisma/client';
import test from 'ava';

import { MockWorkspace } from '../../../__tests__/mocks';
import { createTestingApp, TestingApp } from '../../../__tests__/utils';

let app: TestingApp;
let workspace: Workspace;

test.before(async () => {
  process.env.CAFFEINE_API_SECRET = 'test-secret';
  app = await createTestingApp();
  const user = await app.signup();
  workspace = await app.create(MockWorkspace, { owner: user });
});

test.after.always(async () => {
  await app.close();
});

test('should import doc via Caffeine API', async t => {
  const response = await app
    .request('post', `/api/caffeine/workspaces/${workspace.id}/docs`)
    .set('X-CAFFEINE-SECRET', 'test-secret')
    .send({
      title: 'Test Doc',
      markdown: '# Hello World',
      collectionName: 'Test Collection',
    });

  t.is(response.status, 201);
  t.truthy(response.body.docId);

  const docId = response.body.docId;

  // Verify read
  const readResponse = await app
    .request('get', `/api/caffeine/workspaces/${workspace.id}/docs/${docId}`)
    .set('X-CAFFEINE-SECRET', 'test-secret');

  t.is(readResponse.status, 200);
  // The markdown parser might normalize the markdown, so we check if it contains the content
  t.true(readResponse.text.includes('# Hello World'));
});

test('should reject without secret', async t => {
  const response = await app
    .request('post', `/api/caffeine/workspaces/${workspace.id}/docs`)
    .send({
      title: 'Test Doc',
      markdown: '# Hello World',
    });

  t.is(response.status, 401);
});

test('should list collections', async t => {
  // First import a doc into a collection
  await app
    .request('post', `/api/caffeine/workspaces/${workspace.id}/docs`)
    .set('X-CAFFEINE-SECRET', 'test-secret')
    .send({
      title: 'Collection Doc',
      markdown: 'Content',
      collectionName: 'API Collection',
    });

  const response = await app
    .request('get', `/api/caffeine/workspaces/${workspace.id}/collections`)
    .set('X-CAFFEINE-SECRET', 'test-secret');

  t.is(response.status, 200);
  t.true(Array.isArray(response.body));
  const collection = response.body.find(
    (c: any) => c.name === 'API Collection'
  );
  t.truthy(collection);
  t.true(collection.allowList.length > 0);
});
