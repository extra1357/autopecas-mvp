import { PrismaService } from '../prisma/prisma.service';
import { Workflow, WorkflowContext, WorkflowResult } from './workflow.engine';

export class BuscarPecaWorkflow implements Workflow {
  nome = 'BuscarPecaWorkflow';
  intents = ['buscar_peca', 'consultar_preco', 'consultar_estoque'];

  async executar(ctx: WorkflowContext, prisma: PrismaService): Promise<WorkflowResult> {
    const { peca, veiculo, ano, pagamento, entrega } = ctx.entidades;

    // 1. Valida dados mínimos
    if (!peca) {
      return {
        resposta: 'Qual peça você precisa? Ex: amortecedor, pastilha de freio, filtro de óleo...',
        novoEstado: 'AGUARDANDO_PECA',
        acoes: ['SOLICITAR_PECA'],
        handoff: { necessario: false },
      };
    }

    if (!veiculo) {
      return {
        resposta: `Para encontrar *${peca}* no estoque, preciso saber o veículo. Qual é o modelo e ano?`,
        novoEstado: 'AGUARDANDO_VEICULO',
        acoes: ['SOLICITAR_VEICULO'],
        handoff: { necessario: false },
      };
    }

    // 2. Consulta estoque
    const termos = peca.toLowerCase().split(' ');
    const produtos = await prisma.produto.findMany({
      where: {
        OR: [
          { nome: { contains: termos[0], mode: 'insensitive' } },
          { aplicacao: { contains: veiculo, mode: 'insensitive' } },
          { codigo: { contains: termos[0], mode: 'insensitive' } },
        ],
        estoque: { gt: 0 },
      },
      take: 3,
      orderBy: { preco: 'asc' },
    });

    // 3. Sem estoque — handoff ou similar
    if (produtos.length === 0) {
      return {
        resposta: `Não encontrei *${peca}* para *${veiculo}* no estoque agora. Vou verificar com nossa equipe se conseguimos em outro fornecedor.`,
        novoEstado: 'AGUARDANDO_VENDEDOR',
        acoes: ['ESTOQUE_ZERADO', 'SOLICITAR_HANDOFF'],
        handoff: {
          necessario: true,
          motivo: `Peça não encontrada no estoque: ${peca} para ${veiculo}`,
          prioridade: 'MEDIA',
        },
      };
    }

    // 4. Produto encontrado
    const produto = produtos[0];
    const preco = Number(produto.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // 5. Ticket alto → handoff
    if (Number(produto.preco) > 500) {
      return {
        resposta: `Encontrei *${produto.nome}* por *${preco}*.\n\nPor ser um item de maior valor, vou acionar um especialista para te atender com mais atenção. Aguarde!`,
        novoEstado: 'AGUARDANDO_VENDEDOR',
        acoes: ['PRODUTO_ENCONTRADO', 'TICKET_ALTO', 'SOLICITAR_HANDOFF'],
        handoff: {
          necessario: true,
          motivo: `Ticket alto: ${produto.nome} — ${preco}`,
          prioridade: 'ALTA',
        },
      };
    }

    // 6. Pergunta sobre entrega
    if (!entrega) {
      let msg = `✅ Temos *${produto.nome}* em estoque!\n`;
      msg += `💰 Preço: *${preco}*\n`;
      msg += `📦 Estoque: ${produto.estoque} unidade(s)\n\n`;
      msg += `Você prefere *entrega* ou *retirada na loja*?`;

      if (produtos.length > 1) {
        msg += `\n\n_Também temos outras opções disponíveis caso queira comparar._`;
      }

      return {
        resposta: msg,
        novoEstado: 'AGUARDANDO_ENDERECO',
        acoes: ['PRODUTO_ENCONTRADO', 'SOLICITAR_ENTREGA'],
        handoff: { necessario: false },
      };
    }

    // 7. Pergunta sobre pagamento
    if (!pagamento) {
      return {
        resposta: `Perfeito! *${entrega === 'delivery' ? 'Entrega' : 'Retirada'}* confirmada.\n\nQual a forma de pagamento? PIX, cartão ou dinheiro?`,
        novoEstado: 'AGUARDANDO_PAGAMENTO',
        acoes: ['ENTREGA_CONFIRMADA', 'SOLICITAR_PAGAMENTO'],
        handoff: { necessario: false },
      };
    }

    // 8. Tudo coletado — resumo final
    const resumo = `✅ *Pedido pronto para confirmar!*\n\n` +
      `🔧 Peça: ${produto.nome}\n` +
      `💰 Valor: ${preco}\n` +
      `🚚 Entrega: ${entrega}\n` +
      `💳 Pagamento: ${pagamento}\n\n` +
      `Confirma o pedido?`;

    return {
      resposta: resumo,
      novoEstado: 'AGUARDANDO_PAGAMENTO',
      acoes: ['PEDIDO_PRONTO', 'AGUARDAR_CONFIRMACAO'],
      handoff: { necessario: false },
    };
  }
}
