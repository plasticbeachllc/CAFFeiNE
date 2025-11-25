import { Module } from '@nestjs/common';

import { ModelsModule } from '../../models';
import { DocStorageModule } from '../doc';
import { CollectionService } from './collection.service';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [DocStorageModule, ModelsModule],
  controllers: [WebhookController],
  providers: [CollectionService],
  exports: [CollectionService],
})
export class WebhookModule {}
