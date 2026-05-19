import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappTestController } from './whatsapp-test.controller';
import { WhatsappService } from './whatsapp.service';
import { ConversasModule } from '../conversations/conversas.module';
import { AiModule } from '../ai/ai.module';
import { InventoryModule } from '../inventory/inventory.module';
import { HandoffModule } from '../handoff/handoff.module';

@Module({
  imports: [ConversasModule, AiModule, InventoryModule, HandoffModule],
  controllers: [WhatsappController, WhatsappTestController],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
