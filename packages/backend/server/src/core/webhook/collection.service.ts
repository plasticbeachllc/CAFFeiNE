import { Injectable, Logger } from '@nestjs/common';
import { nanoid } from 'nanoid';
import * as Y from 'yjs';

import { Models } from '../../models';
import { PgWorkspaceDocStorageAdapter } from '../doc/adapters/workspace';

export interface CollectionInfo {
  id: string;
  name: string;
  rules: {
    filters: any[];
  };
  allowList: string[];
}

@Injectable()
export class CollectionService {
  private readonly logger = new Logger(CollectionService.name);

  constructor(
    private readonly docStorage: PgWorkspaceDocStorageAdapter,
    private readonly models: Models
  ) {}

  /**
   * Get all collections for a workspace
   */
  async getCollections(workspaceId: string): Promise<CollectionInfo[]> {
    const snapshot = await this.models.doc.get(workspaceId, workspaceId);
    if (!snapshot) return [];

    const doc = new Y.Doc();
    Y.applyUpdate(doc, snapshot.blob);

    const settingMap = doc.getMap('setting');
    const collectionsArray = settingMap.get(
      'collections'
    ) as Y.Array<CollectionInfo>;

    if (!collectionsArray) return [];

    return collectionsArray.toArray();
  }

  /**
   * Add documents to a collection (by name). Creates the collection if it doesn't exist.
   * This modifies the workspace's root YDoc (space:meta).
   * Also adds page metadata to 'meta.pages' for mobile compatibility.
   */
  async addDocsToCollection(
    workspaceId: string,
    collectionName: string,
    docs: Array<{ id: string; title: string }>
  ): Promise<void> {
    if (docs.length === 0) return;

    // 1. Fetch the root doc (docId = workspaceId)
    // The root doc contains the 'setting' map which holds 'collections'
    // We use models directly because getDocSnapshot is protected in the adapter
    const snapshot = await this.models.doc.get(workspaceId, workspaceId);

    const doc = new Y.Doc();

    if (snapshot) {
      Y.applyUpdate(doc, snapshot.blob);
    } else {
      // If root doc doesn't exist (new workspace), we start with empty
      this.logger.log(
        `Root doc not found for workspace ${workspaceId}, creating new one.`
      );
    }

    // 2. Capture updates
    const updates: Uint8Array[] = [];
    doc.on('update', update => {
      updates.push(update);
    });

    // 3. Modify the YDoc
    doc.transact(() => {
      const settingMap = doc.getMap('setting');
      let collectionsArray = settingMap.get(
        'collections'
      ) as Y.Array<CollectionInfo>;

      // Initialize collections if missing
      if (!collectionsArray) {
        collectionsArray = new Y.Array<CollectionInfo>();
        settingMap.set('collections', collectionsArray);
      }

      // Handle Page Metadata (DocMeta) for Mobile Compatibility
      const metaMap = doc.getMap('meta');
      let pagesArray = metaMap.get('pages') as Y.Array<any>;

      if (!pagesArray) {
        pagesArray = new Y.Array<any>();
        metaMap.set('pages', pagesArray);
      }

      // Cleanup invalid entries (plain objects instead of YMaps) which cause indexer crashes
      for (let i = pagesArray.length - 1; i >= 0; i--) {
        const item = pagesArray.get(i);
        if (!(item instanceof Y.Map)) {
          this.logger.warn(`Removing invalid page meta at index ${i}`);
          pagesArray.delete(i, 1);
        }
      }

      // Add metadata for new docs
      const existingPageIds = new Set(
        pagesArray.toArray().map((p: any) => p.get('id'))
      );
      const now = Date.now();

      docs.forEach(({ id, title }) => {
        if (!existingPageIds.has(id)) {
          const newMeta = new Y.Map();
          newMeta.set('id', id);
          newMeta.set('title', title || 'Untitled');
          newMeta.set('tags', new Y.Array());
          newMeta.set('createDate', now);
          newMeta.set('updatedDate', now);
          newMeta.set('favorite', false);
          newMeta.set('trash', false);

          pagesArray.push([newMeta]);
          this.logger.log(`Added DocMeta (YMap) for ${id} (${title})`);
        }
      });

      // Find existing collection
      let found = false;
      let index = 0;
      const docIds = docs.map(d => d.id);

      const content = collectionsArray.toArray();

      for (const collection of content) {
        if (collection.name === collectionName) {
          found = true;

          // Filter out docs that are already in the collection
          const newDocs = docIds.filter(
            id => !collection.allowList.includes(id)
          );

          if (newDocs.length > 0) {
            const updatedCollection = {
              ...collection,
              allowList: [...collection.allowList, ...newDocs],
            };

            // Delete old and insert new at same position
            collectionsArray.delete(index, 1);
            collectionsArray.insert(index, [updatedCollection]);

            this.logger.log(
              `Added docs ${newDocs.join(', ')} to existing collection ${collectionName}`
            );
          } else {
            this.logger.debug(
              `All docs already in collection ${collectionName}`
            );
          }
          break;
        }
        index++;
      }

      // Create new collection if not found
      if (!found) {
        const newCollection: CollectionInfo = {
          id: nanoid(),
          name: collectionName,
          rules: { filters: [] },
          allowList: docIds,
        };
        collectionsArray.push([newCollection]);
        this.logger.log(
          `Created new collection ${collectionName} with docs ${docIds.join(', ')}`
        );
      }
    });

    // 4. Push updates back to storage
    if (updates.length > 0) {
      // Merge all updates into one for efficiency
      const mergedUpdate = Y.mergeUpdates(updates);
      await this.docStorage.pushDocUpdates(workspaceId, workspaceId, [
        mergedUpdate,
      ]);
      this.logger.log(`Saved collection updates to workspace ${workspaceId}`);
    } else {
      this.logger.debug('No collection updates needed');
    }
  }
}
