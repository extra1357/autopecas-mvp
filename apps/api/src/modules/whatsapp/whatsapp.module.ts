import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappTestController } from './whatsapp-test.controller';
import { InatividadeService } from './inatividade.service';
import { ConversasModule } from '../conversations/conversas.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConversasModule, PrismaModule],
  controllers: [WhatsappController, WhatsappTestController],
  providers: [WhatsappService, InatividadeService],
  exports: [WhatsappService],
})
export class WhatsappModule {}