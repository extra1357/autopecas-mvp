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

  private disponibilidade(estoque: number): string {
    if (estoque >= 10) return 'Disponivel';
    if (estoque >= 3) return 'Ultimas unidades';
    return 'Estoque baixo';
  }

  async executar(ctx: WorkflowContext, prisma: PrismaService): Promise<WorkflowResult> {
    const { peca, veiculo, ano } = ctx.entidades;

    const conversaAtual = await prisma.conversa.findUnique({
      where: { id: ctx.conversaId },
      select: { contexto: true },
    });
    const contexto = (conversaAtual?.contexto as Record<string, any>) || ctx.contexto;
    const carrinho: any[] = contexto.carrinho || [];

    // MODULO 3 — Recupera veiculo salvo no perfil do cliente
    const perfilCliente = await prisma.cliente.findUnique({
      where: { id: ctx.clienteId },
      select: { veiculoModelo: true, veiculoAno: true },
    });

    const veiculoFinal = veiculo || contexto.veiculoAtual || perfilCliente?.veiculoModelo || null;
    const anoFinal = ano || contexto.anoAtual || perfilCliente?.veiculoAno || null;
    const pecaFinal = peca || contexto.pecaPendente;

    if (veiculoFinal && !contexto.veiculoAtual) {
      this.logger.log(`Veiculo restaurado do perfil: ${veiculoFinal} ${anoFinal}`);
    }

    if (!pecaFinal) {
      return {
        resposta: 'Qual peca voce precisa? Ex: amortecedor, pastilha de freio, filtro de oleo...',
        novoEstado: 'AGUARDANDO_PECA',
        acoes: ['SOLICITOU_PECA'],
        handoff: { necessario: false },
      };
    }

    if (!veiculoFinal || !anoFinal) {
      const faltando = !veiculoFinal && !anoFinal
        ? 'o modelo e o ano do veiculo'
        : !veiculoFinal
          ? 'o modelo do veiculo (ex: HB20, Gol, Corolla)'
          : 'o ano do veiculo (ex: 2019, 2022)';

      await prisma.conversa.update({
        where: { id: ctx.conversaId },
        data: { contexto: { ...contexto, pecaPendente: pecaFinal } },
      });

      return {
        resposta: `Para buscar *${pecaFinal}* com precisao, preciso saber ${faltando}.\n\nPara qual veiculo e qual ano?`,
        novoEstado: 'AGUARDANDO_VEICULO',
        acoes: ['SOLICITOU_VEICULO_ANO'],
        handoff: { necessario: false },
      };
    }

    // MODULO 3 — Salva veiculo no perfil sempre que for confirmado
    const veiculoEraDesconhecido = !perfilCliente?.veiculoModelo || perfilCliente.veiculoModelo !== veiculoFinal;
    if (veiculoEraDesconhecido) {
      await prisma.cliente.update({
        where: { id: ctx.clienteId },
        data: {
          veiculoModelo: veiculoFinal,
          veiculoAno: anoFinal,
        },
      });
      this.logger.log(`Veiculo salvo no perfil: ${veiculoFinal} ${anoFinal}`);
    }

    const novoContextoBase = {
      ...contexto,
      veiculoAtual: veiculoFinal,
      anoAtual: anoFinal,
      pecaPendente: null,
    };

    this.logger.log(`Buscando: ${pecaFinal} | ${veiculoFinal} | ${anoFinal}`);
    const produtos = await this.inventory.buscarPeca(pecaFinal, veiculoFinal, anoFinal);

    if (produtos.length > 0) {
      const p = produtos[0];
      const outros = produtos.length > 1 ? ` Tambem temos mais ${produtos.length - 1} opcao(oes).` : '';

      carrinho.push({
        id: p.id,
        nome: p.nome,
        marca: p.marca,
        aplicacao: p.aplicacao,
        veiculo: veiculoFinal,
        ano: anoFinal,
        preco: p.preco,
        quantidade: 1,
      });

      await prisma.conversa.update({
        where: { id: ctx.conversaId },
        data: { contexto: { ...novoContextoBase, carrinho } },
      });

      return {
        resposta: `Encontrei! *${p.nome}* (${p.marca}) para ${p.aplicacao}.\nPreco: *R$ ${p.preco.toFixed(2)}* | ${this.disponibilidade(p.estoque)}.${outros}\n\n? Item adicionado!\n\nPosso ajudar com mais alguma peca ou acessorio?`,
        novoEstado: 'AGUARDANDO_MAIS_ITENS',
        acoes: ['PECA_ENCONTRADA'],
        handoff: { necessario: false },
      };
    }

    const produtosSemAno = await this.inventory.buscarPeca(pecaFinal, veiculoFinal);
    if (produtosSemAno.length > 0) {
      const aplicacoes = [...new Set(produtosSemAno.map(p => p.aplicacao))].join(', ');
      await prisma.conversa.update({
        where: { id: ctx.conversaId },
        data: { contexto: novoContextoBase },
      });
      return {
        resposta: `Nao encontrei *${pecaFinal}* para ${veiculoFinal} ${anoFinal}.\n\nTemos esse produto para: ${aplicacoes}.\n\nVerifique o ano do seu veiculo ou entre em contato com um vendedor.`,
        novoEstado: 'AGUARDANDO_MAIS_ITENS',
        acoes: ['ANO_INCOMPATIVEL'],
        handoff: { necessario: false },
      };
    }

    const similares = await this.inventory.buscarSimilares(pecaFinal);
    if (similares.length > 0) {
      const nomes = similares.map(s => `- ${s.nome} para ${s.aplicacao} | R$ ${s.preco.toFixed(2)}`).join('\n');
      await prisma.conversa.update({
        where: { id: ctx.conversaId },
        data: { contexto: novoContextoBase },
      });
      return {
        resposta: `Nao encontrei *${pecaFinal}* para ${veiculoFinal} ${anoFinal} especificamente, mas temos:\n${nomes}\n\nAlguma dessas serve?`,
        novoEstado: 'AGUARDANDO_MAIS_ITENS',
        acoes: ['SIMILAR_ENCONTRADO'],
        handoff: { necessario: false },
      };
    }

    const semanticos = await this.inventory.buscarPecaSemantica(pecaFinal, veiculoFinal);
    if (semanticos.length > 0) {
      const nomes = semanticos.map(s => `- ${s.nome} para ${s.aplicacao} | R$ ${s.preco.toFixed(2)}`).join('\n');
      await prisma.conversa.update({
        where: { id: ctx.conversaId },
        data: { contexto: novoContextoBase },
      });
      return {
        resposta: `Nao encontrei exatamente *${pecaFinal}*, mas esses produtos podem ser o que voce precisa:\n${nomes}\n\nAlgum desses serve?`,
        novoEstado: 'AGUARDANDO_MAIS_ITENS',
        acoes: ['SEMANTICO_ENCONTRADO'],
        handoff: { necessario: false },
      };
    }

    await prisma.conversa.update({
      where: { id: ctx.conversaId },
      data: { contexto: novoContextoBase },
    });

    return {
      resposta: `Nao encontrei *${pecaFinal}* para ${veiculoFinal} ${anoFinal} no nosso estoque.\n\nPosso buscar outra peca, ou finalizamos o pedido com os itens ja selecionados?`,
      novoEstado: 'AGUARDANDO_MAIS_ITENS',
      acoes: ['PECA_NAO_ENCONTRADA'],
      handoff: { necessario: false },
    };
  }
}
