import { Module } from '@nestjs/common';

import { PrismaModule } from '../../base';
import { DocStorageModule } from '../doc';
import { PermissionModule } from '../permission';
import { QuotaModule } from '../quota';
import { StorageModule } from '../storage';
import { UserModule } from '../user';
import { WebhookModule } from '../webhook/webhook.module';
import { WorkspaceModule } from '../workspaces';
import { CaffeineController } from './controller';
import { CaffeineService } from './service';

@Module({
  imports: [
    PermissionModule,
    WorkspaceModule,
    DocStorageModule,
    StorageModule,
    UserModule,
    QuotaModule,
    WebhookModule, // Import WebhookModule to access CollectionService
    PrismaModule,
  ],
  controllers: [CaffeineController],
  providers: [CaffeineService],
  exports: [CaffeineService],
})
export class CaffeineModule {}
