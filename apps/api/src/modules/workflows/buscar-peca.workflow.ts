import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { WorkflowEngine, WorkflowContext, WorkflowResult } from './workflow.engine';

@Injectable()
export class BuscarPecaWorkflow implements OnModuleInit {
  private readonly logger = new Logger(BuscarPecaWorkflow.name);
  readonly nome = 'BuscarPecaWorkflow';
  readonly intents = ['buscar_peca', 'consultar_preco', 'consultar_estoque'];

  constructor(
    private inventory: InventoryService,
    private engine: WorkflowEngine,
  ) {}

  onModuleInit() {
    this.engine.registrar(this);
  }

  async executar(ctx: WorkflowContext, prisma: PrismaService): Promise<WorkflowResult> {
    const { peca, veiculo, ano } = ctx.entidades;

    if (!peca) {
      return {
        resposta: 'Qual peca voce precisa? Ex: amortecedor, pastilha de freio, filtro de oleo...',
        novoEstado: 'AGUARDANDO_PECA',
        acoes: ['SOLICITOU_PECA'],
        handoff: { necessario: false },
      };
    }

    this.logger.log(`Buscando: ${peca} | ${veiculo} | ${ano}`);
    const produtos = await this.inventory.buscarPeca(peca, veiculo, ano);

    if (produtos.length > 0) {
      const p = produtos[0];
      const disponibilidade = p.estoque > 0 ? `${p.estoque} em estoque` : 'ultimo disponivel';
      const outros = produtos.length > 1 ? ` Tambem temos mais ${produtos.length - 1} opcao(oes).` : '';

      return {
        resposta: `Encontrei! *${p.nome}* (${p.marca}) para ${p.aplicacao}.\nPreco: *R$ ${p.preco.toFixed(2)}* | ${disponibilidade}.${outros}\n\nQuer delivery ou retirada na loja?`,
        novoEstado: 'AGUARDANDO_ENDERECO',
        acoes: ['PECA_ENCONTRADA'],
        handoff: { necessario: false },
      };
    }

    const similares = await this.inventory.buscarSimilares(peca);

    if (similares.length > 0) {
      const nomes = similares.map(s => `- ${s.nome} para ${s.aplicacao} | R$ ${s.preco.toFixed(2)}`).join('\n');
      return {
        resposta: `Nao encontrei *${peca}* para ${veiculo || 'esse veiculo'} especificamente, mas temos:\n${nomes}\n\nAlguma dessas serve?`,
        novoEstado: 'CONSULTANDO_ESTOQUE',
        acoes: ['SIMILAR_ENCONTRADO'],
        handoff: { necessario: false },
      };
    }

    return {
      resposta: `Nao temos *${peca}* em estoque agora. Vou acionar um especialista para verificar com nossos fornecedores!`,
      novoEstado: 'AGUARDANDO_VENDEDOR',
      acoes: ['PECA_NAO_ENCONTRADA'],
      handoff: {
        necessario: true,
        motivo: `Peca nao encontrada: ${peca} para ${veiculo || 'veiculo nao informado'}`,
        prioridade: 'MEDIA',
      },
    };
  }
}
