import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowEngine, WorkflowContext, WorkflowResult } from './workflow.engine';

@Injectable()
export class EntregaWorkflow implements OnModuleInit {
  private readonly logger = new Logger(EntregaWorkflow.name);
  readonly nome = 'EntregaWorkflow';
  readonly intents = ['escolher_entrega', 'escolher_retirada', 'informar_endereco', 'informar_pagamento'];

  constructor(private engine: WorkflowEngine) {}

  onModuleInit() {
    this.engine.registrar(this);
  }

  async executar(ctx: WorkflowContext, prisma: PrismaService): Promise<WorkflowResult> {
    const { intent, entidades, contexto } = ctx;

    // Cliente escolheu delivery
    if (intent === 'escolher_entrega') {
      await prisma.conversa.update({
        where: { id: ctx.conversaId },
        data: { contexto: { ...contexto, tipoEntrega: 'delivery' } },
      });
      return {
        resposta: 'Otimo! Qual o endereco de entrega? (Rua, numero, bairro, cidade)',
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
        resposta: 'Perfeito! Voce pode retirar na loja. Qual forma de pagamento? (Pix, cartao ou dinheiro)',
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
        resposta: `Endereco anotado! Qual forma de pagamento? (Pix, cartao ou dinheiro)`,
        novoEstado: 'AGUARDANDO_PAGAMENTO',
        acoes: ['ENDERECO_INFORMADO'],
        handoff: { necessario: false },
      };
    }

    // Cliente informou pagamento
    if (intent === 'informar_pagamento' && entidades.pagamento) {
      return {
        resposta: `Pedido registrado! Pagamento via *${entidades.pagamento}*.\n\nUm vendedor vai confirmar seu pedido em breve e passar os detalhes finais. Obrigado! 🙏`,
        novoEstado: 'AGUARDANDO_VENDEDOR',
        acoes: ['PAGAMENTO_INFORMADO'],
        handoff: {
          necessario: true,
          motivo: `Pedido pronto. Entrega: ${contexto.tipoEntrega || 'retirada'}. Pagamento: ${entidades.pagamento}. Peca: ${contexto.peca || 'ver historico'}`,
          prioridade: 'MEDIA',
        },
      };
    }

    // Fallback - pede para repetir
    return {
      resposta: 'Desculpe, nao entendi. Voce quer *delivery* ou *retirada na loja*?',
      novoEstado: ctx.estadoAtual,
      acoes: ['FALLBACK_ENTREGA'],
      handoff: { necessario: false },
    };
  }
}