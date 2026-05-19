import { Module } from '@nestjs/common';
import { ConversasService } from './conversas.service';
import { ConversasController } from './conversas.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import { HandoffModule } from '../handoff/handoff.module';

@Module({
  imports: [PrismaModule, AiModule, WorkflowsModule, HandoffModule],
  providers: [ConversasService],
  controllers: [ConversasController],
  exports: [ConversasService],
})
export class ConversasModule {}
