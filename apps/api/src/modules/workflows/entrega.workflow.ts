import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowEngine, WorkflowContext, WorkflowResult } from './workflow.engine';

@Injectable()
export class EntregaWorkflow implements OnModuleInit {
  private readonly logger = new Logger(EntregaWorkflow.name);
  readonly nome = 'EntregaWorkflow';
  readonly intents = [
    'escolher_entrega',
    'escolher_retirada',
    'informar_endereco',
    'informar_pagamento',
    'confirmar_pedido',
    'querer_mais_itens',
    'finalizar_itens',
    'corrigir_pedido',
  ];

  constructor(private engine: WorkflowEngine) {}

  onModuleInit() {
    this.engine.registrar(this);
  }

  private gerarResumo(ctx: WorkflowContext): string {
    const carrinho: any[] = ctx.contexto.carrinho || [];
    const itens = carrinho.map((item, i) => `  ${i + 1}. ${item.nome} (${item.marca}) - R$ ${Number(item.preco).toFixed(2)}`).join('\n');
    const total = carrinho.reduce((sum, item) => sum + Number(item.preco) * (item.quantidade || 1), 0);
    const modalidade = ctx.contexto.tipoEntrega === 'delivery' ? 'Entrega' : 'Retirada na loja';
    const endereco = ctx.contexto.tipoEntrega === 'delivery' ? `\n• Endereco: ${ctx.contexto.endereco || 'nao informado'}` : '';
    const pagamento = ctx.contexto.pagamento || 'nao informado';

    return `📋 *RESUMO DO PEDIDO*\n\n• Produtos:\n${itens}\n• Total: *R$ ${total.toFixed(2)}*\n• Modalidade: ${modalidade}${endereco}\n• Pagamento: ${pagamento}\n\nEsta tudo correto?`;
  }

  async executar(ctx: WorkflowContext, prisma: PrismaService): Promise<WorkflowResult> {
    const { intent, entidades, contexto } = ctx;
    const carrinho: any[] = contexto.carrinho || [];

    // Cliente quer mais itens
    if (intent === 'querer_mais_itens') {
      return {
        resposta: 'Claro! Pode me informar a peca ou acessorio que voce procura.',
        novoEstado: 'AGUARDANDO_PECA',
        acoes: ['QUER_MAIS_ITENS'],
        handoff: { necessario: false },
      };
    }

    // Cliente finalizou itens — pergunta entrega ou retirada
    if (intent === 'finalizar_itens') {
      return {
        resposta: 'Perfeito! Voce prefere retirar na loja ou receber por entrega?',
        novoEstado: 'AGUARDANDO_TIPO_ATENDIMENTO',
        acoes: ['FINALIZOU_ITENS'],
        handoff: { necessario: false },
      };
    }

    // Cliente escolheu delivery
    if (intent === 'escolher_entrega') {
      await prisma.conversa.update({
        where: { id: ctx.conversaId },
        data: { contexto: { ...contexto, tipoEntrega: 'delivery' } },
      });
      return {
        resposta: 'Por favor, informe o endereco completo para entrega.\n(Rua, numero, bairro, cidade)',
        novoEstado: 'AGUARDANDO_ENDERECO',
        acoes: ['ESCOLHEU_DELIVERY'],
        handoff: { necessario: false },
      };
    }

    // Cliente escolheu retirada
    if (intent === 'escolher_retirada') {
      await prisma.conversa.update({
        where: { id: ctx.conversaId },
        data: { contexto: { ...contexto, tipoEntrega: 'retirada' } },
      });
      return {
        resposta: 'Otimo! Qual sera a forma de pagamento?\n(Pix, Cartao de Credito, Cartao de Debito ou Dinheiro)',
        novoEstado: 'AGUARDANDO_PAGAMENTO',
        acoes: ['ESCOLHEU_RETIRADA'],
        handoff: { necessario: false },
      };
    }

    // Cliente informou endereco
    if (intent === 'informar_endereco' && entidades.endereco) {
      await prisma.conversa.update({
        where: { id: ctx.conversaId },
        data: { contexto: { ...contexto, endereco: entidades.endereco } },
      });
      return {
        resposta: 'Endereco anotado! Qual sera a forma de pagamento?\n(Pix, Cartao de Credito, Cartao de Debito ou Dinheiro)',
        novoEstado: 'AGUARDANDO_PAGAMENTO',
        acoes: ['ENDERECO_INFORMADO'],
        handoff: { necessario: false },
      };
    }

    // Cliente informou pagamento — mostra resumo
    if (intent === 'informar_pagamento' && entidades.pagamento) {
      const novoContexto = { ...contexto, pagamento: entidades.pagamento };
      await prisma.conversa.update({
        where: { id: ctx.conversaId },
        data: { contexto: novoContexto },
      });
      const resumo = this.gerarResumo({ ...ctx, contexto: novoContexto });
      return {
        resposta: resumo,
        novoEstado: 'AGUARDANDO_CONFIRMACAO_KIT',
        acoes: ['PAGAMENTO_INFORMADO'],
        handoff: { necessario: false },
      };
    }

    // Cliente confirmou pedido — chama vendedor
    if (intent === 'confirmar_pedido') {
      const itens = carrinho.map(i => `${i.nome} (${i.marca}) - R$ ${Number(i.preco).toFixed(2)}`).join(', ');
      const total = carrinho.reduce((sum, i) => sum + Number(i.preco), 0);
      return {
        resposta: 'Perfeito! Vou encaminhar seu pedido para um de nossos vendedores finalizar o atendimento. Em breve entraremos em contato! 🙏',
        novoEstado: 'AGUARDANDO_VENDEDOR',
        acoes: ['PEDIDO_CONFIRMADO'],
        handoff: {
          necessario: true,
          motivo: `PEDIDO CONFIRMADO\nItens: ${itens}\nTotal: R$ ${total.toFixed(2)}\nModalidade: ${contexto.tipoEntrega || 'retirada'}\nEndereco: ${contexto.endereco || 'retirada na loja'}\nPagamento: ${contexto.pagamento}`,
          prioridade: 'ALTA',
        },
      };
    }

    // Cliente quer corrigir algo
    if (intent === 'corrigir_pedido') {
      return {
        resposta: 'Claro! O que voce gostaria de corrigir? (produto, endereco, forma de pagamento ou modalidade de entrega)',
        novoEstado: ctx.estadoAtual,
        acoes: ['CORRECAO_SOLICITADA'],
        handoff: { necessario: false },
      };
    }

    return {
      resposta: 'Desculpe, nao entendi. Voce quer *retirar na loja* ou receber por *entrega*?',
      novoEstado: ctx.estadoAtual,
      acoes: ['FALLBACK_ENTREGA'],
      handoff: { necessario: false },
    };
  }
}