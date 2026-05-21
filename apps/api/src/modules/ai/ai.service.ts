import { Injectable, Logger } from '@nestjs/common';
import Groq from 'groq-sdk';

export interface IntentResult {
  intent: string;
  entidades: {
    peca?: string;
    veiculo?: string;
    ano?: string;
    marca?: string;
    pagamento?: string;
    entrega?: string;
  };
  confianca: number;
  resposta?: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private groq: Groq;

  constructor() {
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }

  async processarMensagem(mensagem: string): Promise<IntentResult> {
    this.logger.log('Processando: ' + mensagem);
    const prompt = 'Analise a mensagem de um cliente de autopeças e retorne APENAS JSON.\n\nIntents: buscar_peca, consultar_preco, consultar_estoque, entrega, retirada, falar_vendedor, status_pedido, saudacao, outro\n\nFormato: {"intent":"buscar_peca","entidades":{"peca":"amortecedor","veiculo":"HB20","ano":"2021","marca":"Hyundai","pagamento":null,"entrega":null},"confianca":0.95,"resposta":"Texto para o cliente"}\n\nMensagem: "' + mensagem + '"';
    try {
      const completion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama3-8b-8192',
        temperature: 0.1,
        max_tokens: 300,
      });
      const content = completion.choices[0]?.message?.content || '';
      this.logger.log('Groq: ' + content);
      return JSON.parse(content.trim());
    } catch (error) {
      this.logger.error('Erro: ' + error.message);
      return { intent: 'outro', entidades: {}, confianca: 0, resposta: 'Pode reformular?' };
    }
  }
}