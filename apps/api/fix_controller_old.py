content = open('src/modules/whatsapp/whatsapp.controller.ts').read()
new_content = '''import { Controller, Get, Post, Body, Query, Res, Logger } from '@nestjs/common';
import { Response } from 'express';
import { ConversasService } from '../conversations/conversas.service';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);
  private readonly verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'autopecas_webhook_2026';
  private readonly processedIds = new Set();

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
    this.logger.log(Webhook verificado: mode= token=);
    if (mode === 'subscribe' && token === this.verifyToken) {
      this.logger.log('Webhook aprovado!');
      return parseInt(challenge);
    }
    return 'Token invalido';
  }

  @Post('webhook')
  async receberMensagem(@Body() body: any, @Res() res: Response) {
    res.status(200).send('OK');

    try {
      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages = value?.messages;

      if (!messages || messages.length === 0) return;

      const msg = messages[0];
      const msgId = msg.id;
      const telefone = msg.from;
      const texto = msg.text?.body;

      if (!texto) return;

      if (msgId) {
        if (this.processedIds.has(msgId)) {
          this.logger.warn(Mensagem duplicada ignorada: );
          return;
        }
        this.processedIds.add(msgId);
        setTimeout(() => this.processedIds.delete(msgId), 60000);
      }

      this.logger.log(Mensagem recebida de : );

      const resposta = await this.conversasService.processarMensagem(telefone, texto);
      await this.whatsappService.enviarMensagem(telefone, resposta);

    } catch (error) {
      this.logger.error(Erro no webhook: );
    }
  }
}
'''
with open('src/modules/whatsapp/whatsapp.controller.ts', 'w', encoding='utf-8') as f:
    f.write(new_content)
print('Arquivo salvo com sucesso!')
