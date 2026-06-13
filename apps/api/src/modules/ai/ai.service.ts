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

  async classificarIntencao(mensagem: string, historico: string = '', estadoAtual: string = 'INICIO'): Promise<IntencaoIA> {
    const estadosComPeca = ['AGUARDANDO_MAIS_ITENS', 'AGUARDANDO_TIPO_ATENDIMENTO', 'AGUARDANDO_ENDERECO', 'AGUARDANDO_PAGAMENTO'];
    const temPecaNoCarrinho = estadosComPeca.includes(estadoAtual);

    const prompt = `Voce e um classificador semantico para uma loja de autopecas brasileira.
Analise a mensagem e retorne APENAS um JSON valido, sem texto adicional.

Estado atual da conversa: ${estadoAtual}
O cliente ja tem peca no carrinho: ${temPecaNoCarrinho ? 'SIM' : 'NAO'}

Intents possiveis:
- buscar_peca: cliente quer comprar ou verificar disponibilidade de UMA PECA ESPECIFICA. Exemplos: "tem amortecedor?", "preciso de filtro de oleo", "pastilha de freio para Civic"
- querer_mais_itens: cliente quer adicionar mais pecas. Exemplos: "sim", "quero mais", "tenho outra peca", "adicionar", "mais uma"
- finalizar_itens: cliente nao quer mais pecas. Exemplos: "nao", "so isso", "e tudo", "nao obrigado", "pode finalizar", "somente isso"
- escolher_retirada: cliente quer retirar na loja. SO USE quando "tem peca no carrinho = SIM". Exemplos: "retirada", "vou buscar", "pegar na loja"
- escolher_entrega: cliente quer receber em casa. SO USE quando "tem peca no carrinho = SIM". Exemplos: "delivery", "entrega", "entregar", "me manda"
- informar_endereco: cliente fornece um endereco. QUALQUER mensagem que contenha rua, avenida, numero, bairro, cidade ou CEP.
- informar_pagamento: cliente informa forma de pagamento. Exemplos: "pix", "cartao", "dinheiro", "credito", "debito"
- confirmar_pedido: cliente confirma o pedido. Exemplos: "sim", "confirmo", "esta correto", "pode ser", "tudo certo", "ok"
- corrigir_pedido: cliente quer alterar algo. Exemplos: "nao", "quero mudar", "esta errado", "corrigir"
- encerrar_conversa: cliente se despede ou agradece apos pedido. Exemplos: "obrigado", "tchau", "ate mais", "valeu"
- falar_vendedor: cliente quer falar com humano
- saudacao: APENAS cumprimentos simples sem pergunta. Exemplos: "oi", "ola", "bom dia", "boa tarde", "boa noite"
- desconhecido: perguntas sobre a loja, politicas, horarios, formas de pagamento, garantia, troca, parcelamento, area de entrega. Exemplos: "voces parcelam?", "qual o horario?", "fazem entrega para Itu?", "aceitam cheque?", "qual o prazo de troca?", "tem nota fiscal?", "voces fazem entrega?", "qual a area de entrega?"

REGRAS CRITICAS:
1. buscar_peca SOMENTE quando o cliente citar uma peca automotiva especifica.
2. escolher_entrega e escolher_retirada SOMENTE quando "tem peca no carrinho = SIM". Caso contrario ? desconhecido.
3. Perguntas sobre politicas, horarios, area de entrega, garantia ? SEMPRE desconhecido.
4. saudacao SOMENTE para cumprimentos puros sem nenhuma pergunta.
5. Se a mensagem contem logradouro (Rua, Av, Avenida) ? informar_endereco.

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
      this.logger.debug(`Intent: ${resultado.intent} (confianca: ${resultado.confianca}) | Estado: ${estadoAtual}`);
      return resultado;
    } catch (err) {
      this.logger.error('Erro ao classificar intencao:', err);
      return { intent: 'desconhecido', entidades: {}, confianca: 0 };
    }
  }
}
