import { createHash } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { encodeStateAsUpdate } from 'yjs';

import { PgWorkspaceDocStorageAdapter } from '../doc';
import { DocReader } from '../doc/reader';
import { markdownToYDoc } from '../markdown-parser';
import {
  CollectionInfo,
  CollectionService,
} from '../webhook/collection.service';

@Injectable()
export class CaffeineService {
  private readonly logger = new Logger(CaffeineService.name);

  constructor(
    private readonly collectionService: CollectionService,
    private readonly docReader: DocReader,
    private readonly docStorage: PgWorkspaceDocStorageAdapter,
    private readonly prisma: PrismaClient
  ) {}

  async importDoc(
    workspaceId: string,
    title: string,
    markdown: string,
    collectionName?: string,
    tags?: string[]
  ) {
    // Generate deterministic ID based on title
    try {
      this.logger.log(
        `Importing doc for workspace ${workspaceId} with title ${title}`
      );
      const docId = createHash('md5')
        .update(`${workspaceId}:${title}`)
        .digest('hex')
        .substring(0, 20);
      this.logger.log(`Generated docId: ${docId}`);

      const doc = await markdownToYDoc(markdown, title);
      this.logger.log('Converted markdown to YDoc');

      const update = encodeStateAsUpdate(doc);
      this.logger.log(`Encoded update, size: ${update.length}`);

      await this.docStorage.pushDocUpdates(workspaceId, docId, [update]);
      this.logger.log('Pushed doc updates to storage');

      // Update metadata (Prisma)
      await this.prisma.workspaceDoc.upsert({
        where: {
          workspaceId_docId: {
            workspaceId,
            docId,
          },
        },
        create: {
          workspaceId,
          docId,
          title,
          public: false, // Default to private
          mode: 0, // Page mode
        },
        update: {
          title,
        },
      });
      this.logger.log('Upserted workspaceDoc metadata');

      if (collectionName) {
        this.logger.log(`Adding to collection: ${collectionName}`);
        await this.collectionService.addDocsToCollection(
          workspaceId,
          collectionName,
          [{ id: docId, title }]
        );
      }

      if (tags && tags.length > 0) {
        this.logger.warn(
          `Tags [${tags.join(', ')}] were ignored. Tag support is coming in Phase 2.`
        );
      }

      this.logger.log(
        `Imported doc ${docId} (${title}) into workspace ${workspaceId}`
      );
      return { docId };
    } catch (e) {
      this.logger.error('Failed to import doc', e);
      throw e;
    }
  }

  async readDoc(workspaceId: string, docId: string) {
    this.logger.log(`Reading doc ${docId} from workspace ${workspaceId}`);
    try {
      const md = await this.docReader.getDocMarkdown(workspaceId, docId, false);
      if (!md) {
        this.logger.warn(`Doc ${docId} not found or empty`);
        return null;
      }
      this.logger.log(`Doc ${docId} found, length: ${md.markdown.length}`);
      return md.markdown;
    } catch (e) {
      this.logger.error(`Failed to read doc ${docId}`, e);
      throw e;
    }
  }

  async listCollections(workspaceId: string): Promise<CollectionInfo[]> {
    return this.collectionService.getCollections(workspaceId);
  }
}
