import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface IntentResult {
  intent: string;
  confianca: number;
  entidades: {
    peca?: string;
    veiculo?: string;
    ano?: string;
    marca?: string;
    pagamento?: string;
    entrega?: string;
  };
  resposta_direta?: string;
}

const SYSTEM_PROMPT = `Você é o assistente de uma loja de autopeças.
Analise a mensagem do cliente e retorne APENAS um JSON válido com esta estrutura:

{
  "intent": "buscar_peca|consultar_preco|consultar_estoque|status_pedido|falar_vendedor|saudacao|despedida|outro",
  "confianca": 0.0-1.0,
  "entidades": {
    "peca": "nome da peça se mencionada ou null",
    "veiculo": "modelo do veículo se mencionado ou null",
    "ano": "ano do veículo se mencionado ou null",
    "marca": "marca do veículo se mencionada ou null",
    "pagamento": "pix|cartao|dinheiro|boleto ou null",
    "entrega": "delivery|retirada ou null"
  },
  "resposta_direta": "resposta curta para saudações/despedidas ou null"
}

Regras:
- Para saudações (oi, olá, bom dia), use intent "saudacao" e preencha resposta_direta
- Para pedidos de peças, use "buscar_peca"
- Para perguntas de preço, use "consultar_preco"
- Para "quero falar com atendente/vendedor", use "falar_vendedor"
- Normalize veículos: "gol g5" → veiculo="Gol G5", "hb20" → veiculo="HB20"
- Retorne SOMENTE o JSON, sem texto adicional`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl = 'https://api.groq.com/openai/v1';

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('GROQ_API_KEY') || '';
    this.model = this.config.get<string>('GROQ_MODEL') || 'llama-3.3-70b-versatile';
  }

  async classificarMensagem(
    mensagem: string,
    historicoRecente: string[] = [],
  ): Promise<IntentResult> {
    try {
      const contexto = historicoRecente.length > 0
        ? `\n\nHistórico recente:\n${historicoRecente.join('\n')}`
        : '';

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Mensagem: "${mensagem}"${contexto}` },
          ],
          temperature: 0.1,
          max_tokens: 300,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Groq API error: ${response.status} — ${errBody}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content.trim();
      const json = content.replace(/```json\n?|\n?```/g, '').trim();
      const result: IntentResult = JSON.parse(json);

      this.logger.log(`Intent: ${result.intent} (${result.confianca}) — "${mensagem}"`);
      return result;

    } catch (err) {
      this.logger.error(`Erro ao classificar mensagem: ${err.message}`);
      return { intent: 'buscar_peca', confianca: 0.3, entidades: {} };
    }
  }

  async gerarResposta(prompt: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'Você é um atendente de autopeças. Responda de forma clara, objetiva e amigável. Máximo 3 linhas.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 200,
        }),
      });

      const data = await response.json();
      return data.choices[0].message.content.trim();

    } catch (err) {
      this.logger.error(`Erro ao gerar resposta: ${err.message}`);
      return 'Desculpe, tive um problema. Um atendente vai te ajudar em breve.';
    }
  }
}
