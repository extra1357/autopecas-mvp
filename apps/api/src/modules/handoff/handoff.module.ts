import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { HandoffService } from './handoff.service';
import { HandoffController } from './handoff.controller';
import { HandoffProcessor } from './handoff.processor';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'handoff' }),
    PrismaModule,
  ],
  providers: [HandoffService, HandoffProcessor],
  controllers: [HandoffController],
  exports: [HandoffService],
})
export class HandoffModule {}
