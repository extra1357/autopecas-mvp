import { Controller, Get, Post, Body, Query, Res, Logger } from '@nestjs/common';
import { Response } from 'express';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(private readonly whatsappService: WhatsappService) {}

  // Verificação do webhook pela Meta
  @Get('webhook')
  verificar(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    this.logger.log(`Verificação webhook — mode: ${mode}, token: ${token}`);
    const result = this.whatsappService.verificarWebhook(mode, token, challenge);

    if (result) {
      this.logger.log('✅ Webhook verificado com sucesso!');
      return res.status(200).send(result);
    }

    this.logger.warn('❌ Falha na verificação do webhook');
    return res.status(403).send('Forbidden');
  }

  // Recebe mensagens do WhatsApp
  @Post('webhook')
  async receber(@Body() body: any, @Res() res: Response) {
    // Responde 200 imediatamente para a Meta não reenviar
    res.status(200).send('OK');

    try {
      this.logger.log('📨 Webhook recebido');
      await this.whatsappService.processarWebhook(body);
    } catch (err) {
      this.logger.error(`Erro ao processar webhook: ${err.message}`);
    }
  }
}
