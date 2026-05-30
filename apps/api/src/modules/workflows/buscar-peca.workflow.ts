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

    // Busca contexto atualizado do banco
    const conversaAtual = await prisma.conversa.findUnique({
      where: { id: ctx.conversaId },
      select: { contexto: true },
    });
    const contexto = (conversaAtual?.contexto as Record<string, any>) || ctx.contexto;
    const carrinho: any[] = contexto.carrinho || [];

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
      const outros = produtos.length > 1 ? ` Tambem temos mais ${produtos.length - 1} opcao(oes).` : '';

      carrinho.push({
        id: p.id,
        nome: p.nome,
        marca: p.marca,
        aplicacao: p.aplicacao,
        preco: p.preco,
        quantidade: 1,
      });

      await prisma.conversa.update({
        where: { id: ctx.conversaId },
        data: { contexto: { ...contexto, carrinho, veiculo, ano } },
      });

      return {
        resposta: `Encontrei! *${p.nome}* (${p.marca}) para ${p.aplicacao}.\nPreco: *R$ ${p.preco.toFixed(2)}* | ${p.estoque} em estoque.${outros}\n\n✅ Item adicionado!\n\nPosso ajudar com mais alguma peca ou acessorio?`,
        novoEstado: 'AGUARDANDO_MAIS_ITENS',
        acoes: ['PECA_ENCONTRADA'],
        handoff: { necessario: false },
      };
    }

    const similares = await this.inventory.buscarSimilares(peca);
    if (similares.length > 0) {
      const nomes = similares.map(s => `- ${s.nome} para ${s.aplicacao} | R$ ${s.preco.toFixed(2)}`).join('\n');
      return {
        resposta: `Nao encontrei *${peca}* para ${veiculo || 'esse veiculo'} especificamente, mas temos:\n${nomes}\n\nAlguma dessas serve? Ou posso buscar outra peca para voce.`,
        novoEstado: 'AGUARDANDO_MAIS_ITENS',
        acoes: ['SIMILAR_ENCONTRADO'],
        handoff: { necessario: false },
      };
    }

    return {
      resposta: `Nao encontrei *${peca}* no nosso estoque no momento.\n\nPosso buscar outra peca para voce, ou se preferir, podemos finalizar o pedido com os itens ja selecionados.`,
      novoEstado: 'AGUARDANDO_MAIS_ITENS',
      acoes: ['PECA_NAO_ENCONTRADA'],
      handoff: { necessario: false },
    };
  }
}