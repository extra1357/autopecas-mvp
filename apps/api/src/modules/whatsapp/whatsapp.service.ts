import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConversasService } from '../conversations/conversas.service';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly token: string;
  private readonly phoneId: string;

  constructor(
    private config: ConfigService,
    private conversasService: ConversasService,
  ) {
    this.token = this.config.get<string>('WHATSAPP_TOKEN') || '';
    this.phoneId = this.config.get<string>('WHATSAPP_PHONE_ID') || '';
  }

  async processarWebhook(body: any): Promise<void> {
    try {
      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages = value?.messages;

      if (!messages || messages.length === 0) return;

      const msg = messages[0];
      const telefone = msg.from;
      const conteudo = msg.text?.body;

      if (!conteudo) return;

      this.logger.log(`📱 Mensagem recebida de ${telefone}: "${conteudo}"`);

      const resposta = await this.conversasService.processarMensagem(telefone, conteudo);

      await this.enviarMensagem(telefone, resposta);
    } catch (err) {
      this.logger.error(`Erro ao processar webhook: ${err.message}`);
    }
  }

  async enviarMensagem(telefone: string, texto: string): Promise<void> {
    if (!this.token || !this.phoneId) {
      this.logger.warn(`[MOCK] Enviando para ${telefone}: ${texto}`);
      return;
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${this.phoneId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: telefone,
            type: 'text',
            text: { body: texto },
          }),
        },
      );

      if (!response.ok) {
        const err = await response.text();
        this.logger.error(`Erro ao enviar mensagem WhatsApp: ${err}`);
      } else {
        this.logger.log(`✅ Mensagem enviada para ${telefone}`);
      }
    } catch (err) {
      this.logger.error(`Falha ao enviar mensagem: ${err.message}`);
    }
  }

  verificarWebhook(mode: string, token: string, challenge: string): string | null {
    const verifyToken = this.config.get<string>('WHATSAPP_VERIFY_TOKEN') || 'autopecas_verify';
    if (mode === 'subscribe' && token === verifyToken) {
      return challenge;
    }
    return null;
  }
}
