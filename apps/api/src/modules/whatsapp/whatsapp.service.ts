import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly token = process.env.WHATSAPP_TOKEN;
  private readonly phoneId = process.env.WHATSAPP_PHONE_ID;
  private readonly apiUrl = `https://graph.facebook.com/v25.0/${process.env.WHATSAPP_PHONE_ID}/messages`;

  async enviarMensagem(telefone: string, mensagem: string): Promise<void> {
    try {
      await axios.post(
        this.apiUrl,
        {
          messaging_product: 'whatsapp',
          to: telefone,
          type: 'text',
          text: { body: mensagem },
        },
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
        },
      );
      this.logger.log(`Mensagem enviada para ${telefone}`);
    } catch (error) {
      this.logger.error(`Erro ao enviar mensagem: ${error.message}`);
    }
  }
}
