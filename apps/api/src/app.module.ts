import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './modules/prisma/prisma.module';
import { ConversasModule } from './modules/conversations/conversas.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { HandoffModule } from './modules/handoff/handoff.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { HealthController } from './health.controller';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      url: process.env.REDIS_URL,
      redis: {
        tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
        enableReadyCheck: false,
      },
    }),
    PrismaModule,
    ConversasModule,
    InventoryModule,
    HandoffModule,
    WorkflowsModule,
    WhatsappModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
