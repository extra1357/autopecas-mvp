import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly token = process.env.WHATSAPP_TOKEN;
  private readonly phoneId = process.env.WHATSAPP_PHONE_ID;
  private readonly apiUrl = `https://graph.facebook.com/v25.0/${process.env.WHATSAPP_PHONE_ID}/messages`;

  async enviarMensagem(telefone: string, mensagem: string): Promise<void> {
    if (!this.token || !this.phoneId) {
      this.logger.error('[WhatsApp] WHATSAPP_TOKEN ou WHATSAPP_PHONE_ID não configurados');
      return;
    }
    try {
      await axios.post(
        this.apiUrl,
        { messaging_product: 'whatsapp', to: telefone, type: 'text', text: { body: mensagem } },
        { headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' } },
      );
      this.logger.log(`[WhatsApp] ✅ Mensagem enviada para ${telefone}`);
    } catch (error) {
      const axiosErr = error as AxiosError;
      const status = axiosErr.response?.status;
      const data = JSON.stringify(axiosErr.response?.data ?? {});
      this.logger.error(
        `[WhatsApp] ❌ Falha ao enviar para ${telefone} | status=${status} | body=${data} | msg=${axiosErr.message}`,
      );
      // Relança para que o chamador saiba que a mensagem não foi entregue
      throw error;
    }
  }
}
