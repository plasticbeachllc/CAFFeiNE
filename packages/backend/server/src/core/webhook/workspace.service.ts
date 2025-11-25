import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { Models } from '../../../models';

/**
 * Service for creating and managing test workspaces for webhook development
 */
@Injectable()
export class WebhookWorkspaceService {
  private readonly logger = new Logger(WebhookWorkspaceService.name);

  constructor(private readonly models: Models) {}

  /**
   * Create or get the test workspace for GitHub webhooks
   * Returns the workspace ID
   */
  async getOrCreateWebhookWorkspace(): Promise<string> {
    // For development, we'll create a dedicated webhook test workspace
    // In production, this would come from config
    const testUserId = 'webhook-system-user';

    // Try to find existing workspace with a known name
    const existing = await this.findWebhookWorkspace();
    if (existing) {
      this.logger.debug(`Using existing webhook workspace: ${existing}`);
      return existing;
    }

    // Create new workspace
    const workspaceId = randomUUID();
    this.logger.log(`Creating new webhook test workspace: ${workspaceId}`);

    try {
      await this.models.workspace.create(testUserId, workspaceId);
      return workspaceId;
    } catch (error) {
      this.logger.error('Failed to create webhook workspace', error);
      throw error;
    }
  }

  /**
   * Find existing webhook workspace by looking for one with specific metadata
   */
  private async findWebhookWorkspace(): Promise<string | null> {
    // TODO: Once we add workspace metadata, we can tag the webhook workspace
    // For now, return null to always create fresh
    return null;
  }
}
