import { Controller, Get, Post, Body, Query, Res, Logger } from '@nestjs/common';
import { Response } from 'express';
import { ConversasService } from '../conversations/conversas.service';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);
  private readonly verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'autopecas_webhook_2026';
  private readonly processedIds = new Set<string>();
  private readonly processingByPhone = new Map<string, boolean>();
  private readonly pendingByPhone = new Map<string, { texto: string; timestamp: number }>();

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

      // Deduplicacao por ID de mensagem
      if (msgId) {
        if (this.processedIds.has(msgId)) {
          this.logger.warn(`Mensagem duplicada ignorada: ${msgId}`);
          return;
        }
        this.processedIds.add(msgId);
        setTimeout(() => this.processedIds.delete(msgId), 60000);
      }

      this.logger.log(`Mensagem recebida de ${telefone}: ${texto}`);

      // Se ja esta processando mensagem desse telefone, segura por 4 segundos
      if (this.processingByPhone.get(telefone)) {
        this.logger.warn(`[RateLimit] ${telefone} ja esta sendo processado — aguardando 4s`);
        this.pendingByPhone.set(telefone, { texto, timestamp: Date.now() });

        await new Promise(resolve => setTimeout(resolve, 4000));

        // Verifica se essa ainda e a mensagem pendente mais recente
        const pending = this.pendingByPhone.get(telefone);
        if (!pending || pending.texto !== texto) {
          this.logger.warn(`[RateLimit] Mensagem de ${telefone} descartada — chegou mensagem mais recente`);
          return;
        }
        this.pendingByPhone.delete(telefone);
      }

      // Marca como processando
      this.processingByPhone.set(telefone, true);
      try {
        const resposta = await this.conversasService.processarMensagem(telefone, texto);
        await this.whatsappService.enviarMensagem(telefone, resposta);
      } finally {
        // Libera o lock sempre, mesmo em caso de erro
        this.processingByPhone.delete(telefone);
      }

    } catch (error) {
      this.logger.error(`Erro no webhook: ${error.message}`);
    }
  }
}
