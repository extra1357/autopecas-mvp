import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { HandoffService } from './handoff.service';
import { HandoffController } from './handoff.controller';
import { HandoffProcessor } from './handoff.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'handoff' }),
    PrismaModule,
    forwardRef(() => WhatsappModule),
  ],
  providers: [HandoffService, HandoffProcessor],
  controllers: [HandoffController],
  exports: [HandoffService],
})
export class HandoffModule {}
