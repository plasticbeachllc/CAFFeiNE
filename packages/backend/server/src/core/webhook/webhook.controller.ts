import { Body, Controller, HttpStatus, Logger,Post } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { encodeStateAsUpdate } from 'yjs';

import { Public } from '../auth';
import { PgWorkspaceDocStorageAdapter } from '../doc/adapters/workspace';
import { markdownToYDoc } from '../markdown-parser';
import { CollectionService } from './collection.service';

interface GitHubFile {
  filename: string;
  markdown: string;
}

interface WebhookPayload {
  repository: {
    name: string;
    full_name?: string;
  };
  files: GitHubFile[];
  workspaceId?: string; // Optional: override default workspace
}

@Controller('api/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly docStorage: PgWorkspaceDocStorageAdapter,
    // TODO: Create WorkspaceDocModel in models/ instead of using PrismaClient directly
    private readonly db: PrismaClient,
    private readonly collectionService: CollectionService
  ) {}

  /**
   * Generate deterministic docId from filename
   * This allows overwriting the same file on subsequent pushes
   */
  private generateDocId(repoName: string, filename: string): string {
    const content = `${repoName}:${filename}`;
    return createHash('sha256').update(content).digest('hex').substring(0, 22);
  }

  /**
   * Extract title from markdown frontmatter or first heading
   */
  private extractTitle(markdown: string, filename: string): string {
    // Try to find first heading
    const headingMatch = markdown.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      return headingMatch[1].trim();
    }

    // Fallback to filename without extension
    return filename.replace(/\.md$/i, '');
  }

  @Public()
  @Post('github')
  async handleGithubWebhook(@Body() payload: WebhookPayload) {
    try {
      const { repository, files, workspaceId: overrideWorkspaceId } = payload;

      if (!repository?.name) {
        return {
          status: HttpStatus.BAD_REQUEST,
          error: 'Missing repository.name in payload',
        };
      }

      if (!files || !Array.isArray(files) || files.length === 0) {
        return {
          status: HttpStatus.BAD_REQUEST,
          error: 'Missing or empty files array',
        };
      }

      // Get workspace ID from config or payload
      const workspaceId =
        overrideWorkspaceId || process.env.GITHUB_WEBHOOK_WORKSPACE_ID;

      if (!workspaceId) {
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'GITHUB_WEBHOOK_WORKSPACE_ID not configured',
        };
      }

      // Ensure workspace exists to satisfy Foreign Key constraints
      const workspaceExists = await this.db.workspace.findUnique({
        where: { id: workspaceId },
      });

      if (!workspaceExists) {
        this.logger.log(`Workspace ${workspaceId} not found, creating it...`);
        await this.db.workspace.create({
          data: {
            id: workspaceId,
            public: false,
            // Create a default owner for the workspace if needed, or leave it system-owned
            // For now, we just create the workspace record
          },
        });
      }

      const repoName = repository.name;
      const results = [];
      const importedDocs: Array<{ id: string; title: string }> = [];

      // Process each file
      for (const file of files) {
        try {
          const { filename, markdown } = file;

          if (!filename || !markdown) {
            this.logger.warn(
              `Skipping invalid file entry: ${JSON.stringify(file)}`
            );
            continue;
          }

          // Generate deterministic docId
          const docId = this.generateDocId(repoName, filename);

          // Extract title
          const title = this.extractTitle(markdown, filename);

          // Convert markdown to YDoc
          const doc = await markdownToYDoc(markdown, title);

          // Encode as update
          const update = encodeStateAsUpdate(doc);

          // Save document binary
          await this.docStorage.pushDocUpdates(workspaceId, docId, [update]);

          // Create/update WorkspaceDoc metadata using Prisma
          await this.db.workspaceDoc.upsert({
            where: {
              workspaceId_docId: {
                workspaceId,
                docId,
              },
            },
            update: {
              title: `${repoName}/${filename}`, // Prefix with repo name
            },
            create: {
              workspaceId,
              docId,
              title: `${repoName}/${filename}`,
              mode: 0, // Page mode
              public: false,
            },
          });

          importedDocs.push({ id: docId, title });

          results.push({
            filename,
            docId,
            title,
            success: true,
          });

          this.logger.log(`Imported ${repoName}/${filename} as ${docId}`);
        } catch (error: any) {
          this.logger.error(`Failed to process file ${file.filename}:`, error);
          results.push({
            filename: file.filename,
            success: false,
            error: error.message,
          });
        }
      }

      // Add all imported docs to collection (repo name)
      if (importedDocs.length > 0) {
        await this.collectionService.addDocsToCollection(
          workspaceId,
          repoName,
          importedDocs
        );
        this.logger.log(
          `Added ${importedDocs.length} docs to collection ${repoName}`
        );
      }

      return {
        status: HttpStatus.OK,
        repository: repoName,
        workspaceId,
        processed: results.length,
        results,
      };
    } catch (error: any) {
      this.logger.error('Webhook Error:', error);
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }
}
