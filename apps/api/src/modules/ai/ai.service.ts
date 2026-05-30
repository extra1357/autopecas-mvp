import { Injectable, Logger } from '@nestjs/common';
import Groq from 'groq-sdk';

export interface IntencaoIA {
  intent: string;
  entidades: {
    peca?: string;
    veiculo?: string;
    ano?: string;
    tipo_atendimento?: string;
    endereco?: string;
    pagamento?: string;
  };
  confianca: number;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private groq: Groq;

  constructor() {
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }

  async classificarIntencao(mensagem: string, historico: string = ''): Promise<IntencaoIA> {
    const prompt = `Voce e um classificador semantico para uma loja de autopecas.
Analise a mensagem e retorne APENAS um JSON valido, sem texto adicional.

Intents possiveis:
- buscar_peca: cliente quer comprar ou verificar disponibilidade de peca
- informar_veiculo: cliente informa modelo/ano do veiculo
- escolher_retirada: cliente quer retirar na loja
- escolher_entrega: cliente quer receber em casa
- informar_endereco: cliente fornece endereco de entrega
- informar_pagamento: cliente informa forma de pagamento (pix/cartao/dinheiro)
- falar_vendedor: cliente quer falar com humano
- saudacao: oi, ola, bom dia, etc.
- desconhecido: mensagem nao se encaixa em nenhuma categoria

Historico recente: ${historico || 'nenhum'}
Mensagem atual: "${mensagem}"

Responda APENAS com JSON no formato:
{
  "intent": "nome_do_intent",
  "entidades": {
    "peca": "nome da peca se mencionada ou null",
    "veiculo": "modelo do veiculo se mencionado ou null",
    "ano": "ano se mencionado ou null",
    "tipo_atendimento": "retirada ou entrega ou null",
    "endereco": "endereco completo se fornecido ou null",
    "pagamento": "pix ou cartao ou dinheiro ou null"
  },
  "confianca": 0.0
}`;

    try {
      const completion = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 300,
      });

      const texto = completion.choices[0]?.message?.content?.trim() ?? '';
      const jsonMatch = texto.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON nao encontrado na resposta do Groq');

      const resultado = JSON.parse(jsonMatch[0]) as IntencaoIA;
      this.logger.debug(`Intent: ${resultado.intent} (confianca: ${resultado.confianca})`);
      return resultado;
    } catch (err) {
      this.logger.error('Erro ao classificar intencao:', err);
      return { intent: 'desconhecido', entidades: {}, confianca: 0 };
    }
  }
}