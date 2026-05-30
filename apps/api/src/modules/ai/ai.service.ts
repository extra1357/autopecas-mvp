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
    const prompt = `Voce e um classificador semantico para uma loja de autopecas brasileira.
Analise a mensagem e retorne APENAS um JSON valido, sem texto adicional.

Intents possiveis:
- buscar_peca: cliente quer comprar ou verificar disponibilidade de peca
- querer_mais_itens: cliente quer adicionar mais pecas. Exemplos: "sim", "quero mais", "tenho outra peca", "adicionar", "mais uma", "procurar outro item"
- finalizar_itens: cliente nao quer mais pecas. Exemplos: "nao", "so isso", "e tudo", "apenas isso", "nao obrigado", "pode finalizar", "somente isso", "e so", "nada mais"
- escolher_retirada: cliente quer retirar na loja. Exemplos: "retirada", "vou buscar", "pegar na loja", "retirar", "busco ai"
- escolher_entrega: cliente quer receber em casa. Exemplos: "delivery", "entrega", "entregar", "para entregar", "quero delivery", "manda pra mim", "me manda", "quero receber"
- informar_endereco: cliente fornece endereco de entrega
- informar_pagamento: cliente informa forma de pagamento. Exemplos: "pix", "cartao", "dinheiro", "credito", "debito"
- confirmar_pedido: cliente confirma o pedido. Exemplos: "sim", "confirmo", "esta correto", "pode ser", "tudo certo", "ok"
- corrigir_pedido: cliente quer alterar algo no pedido. Exemplos: "nao", "quero mudar", "esta errado", "corrigir", "alterar"
- falar_vendedor: cliente quer falar com humano
- saudacao: oi, ola, bom dia, boa tarde, boa noite
- desconhecido: nao se encaixa em nenhuma categoria

ATENCAO: Use o historico para entender o contexto.
- Se o bot perguntou "Posso ajudar com mais alguma peca?" e o cliente respondeu "sim" → querer_mais_itens
- Se o bot perguntou "Posso ajudar com mais alguma peca?" e o cliente respondeu "nao" → finalizar_itens
- Se o bot perguntou "Esta tudo correto?" e o cliente respondeu "sim" → confirmar_pedido
- Se o bot perguntou "Esta tudo correto?" e o cliente respondeu "nao" → corrigir_pedido
- Se o bot perguntou "delivery ou retirada" e o cliente respondeu com qualquer variacao → escolher_entrega ou escolher_retirada

Historico recente:
${historico || 'nenhum'}

Mensagem atual: "${mensagem}"

Responda APENAS com JSON:
{
  "intent": "nome_do_intent",
  "entidades": {
    "peca": null,
    "veiculo": null,
    "ano": null,
    "tipo_atendimento": null,
    "endereco": null,
    "pagamento": null
  },
  "confianca": 0.95
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
      if (!jsonMatch) throw new Error('JSON nao encontrado');

      const resultado = JSON.parse(jsonMatch[0]) as IntencaoIA;
      this.logger.debug(`Intent: ${resultado.intent} (confianca: ${resultado.confianca})`);
      return resultado;
    } catch (err) {
      this.logger.error('Erro ao classificar intencao:', err);
      return { intent: 'desconhecido', entidades: {}, confianca: 0 };
    }
  }
}