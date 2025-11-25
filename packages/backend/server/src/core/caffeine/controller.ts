import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import { Public } from '../auth';
import { CaffeineAuthGuard } from './guard';
import { CaffeineService } from './service';

@Controller('/api/caffeine')
@UseGuards(CaffeineAuthGuard)
export class CaffeineController {
  constructor(private readonly caffeineService: CaffeineService) {}

  @Public()
  @Post('/workspaces/:workspaceId/docs')
  async importDoc(
    @Param('workspaceId') workspaceId: string,
    @Body()
    body: {
      title: string;
      markdown: string;
      collectionName?: string;
      tags?: string[];
    }
  ) {
    const result = await this.caffeineService.importDoc(
      workspaceId,
      body.title,
      body.markdown,
      body.collectionName,
      body.tags
    );
    return result;
  }

  @Public()
  @Get('/workspaces/:workspaceId/docs/:docId')
  async readDoc(
    @Param('workspaceId') workspaceId: string,
    @Param('docId') docId: string,
    @Query('format') format: string,
    @Res() res: Response
  ) {
    const markdown = await this.caffeineService.readDoc(workspaceId, docId);
    if (markdown === null) {
      throw new NotFoundException('Document not found');
    }

    if (format === 'json') {
      res.json({ markdown });
    } else {
      res.setHeader('Content-Type', 'text/markdown');
      res.send(markdown);
    }
  }

  @Public()
  @Get('/workspaces/:workspaceId/collections')
  async listCollections(@Param('workspaceId') workspaceId: string) {
    return this.caffeineService.listCollections(workspaceId);
  }
}
