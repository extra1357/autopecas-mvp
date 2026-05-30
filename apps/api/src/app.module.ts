import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from './modules/prisma/prisma.module';
import { ConversasModule } from './modules/conversations/conversas.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { HandoffModule } from './modules/handoff/handoff.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    PrismaModule,
    ConversasModule,
    InventoryModule,
    HandoffModule,
    WorkflowsModule,
    WhatsappModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}