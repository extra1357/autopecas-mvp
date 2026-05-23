import { Controller, Get, Post, Body, Query, Logger } from '@nestjs/common';
import { ConversasService } from '../conversations/conversas.service';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);
  private readonly verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'autopecas_webhook_2026';

  constructor(
    private readonly conversasService: ConversasService,
    private readonly whatsappService: WhatsappService,
  ) {}

  @Get('webhook')
  verificarWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    this.logger.log(`Webhook verificado: mode=${mode} token=${token}`);
    if (mode === 'subscribe' && token === this.verifyToken) {
      this.logger.log('Webhook aprovado!');
      return parseInt(challenge);
    }
    return 'Token invalido';
  }

  @Post('webhook')
  async receberMensagem(@Body() body: any) {
    try {
      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages = value?.messages;

      if (!messages || messages.length === 0) return { status: 'ok' };

      const msg = messages[0];
      const telefone = msg.from;
      const texto = msg.text?.body;

      if (!texto) return { status: 'ok' };

      this.logger.log(`Mensagem recebida de ${telefone}: ${texto}`);

      const resposta = await this.conversasService.processarMensagem(telefone, texto);
      await this.whatsappService.enviarMensagem(telefone, resposta);

      return { status: 'ok' };
    } catch (error) {
      this.logger.error(`Erro no webhook: ${error.message}`);
      return { status: 'error' };
    }
  }
}
