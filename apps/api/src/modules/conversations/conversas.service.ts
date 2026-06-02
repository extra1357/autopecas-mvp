import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { WorkflowEngine } from '../workflows/workflow.engine';
import { HandoffService } from '../handoff/handoff.service';

@Injectable()
export class ConversasService {
  private readonly logger = new Logger(ConversasService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private workflowEngine: WorkflowEngine,
    private handoffService: HandoffService,
  ) {}

  async buscarOuCriarConversa(telefone: string) {
    let cliente = await this.prisma.cliente.findUnique({ where: { telefone } });
    if (!cliente) {
      cliente = await this.prisma.cliente.create({ data: { telefone } });
    }
    let conversa = await this.prisma.conversa.findFirst({
      where: { clienteId: cliente.id, status: { not: 'FINALIZADA' } },
      orderBy: { createdAt: 'desc' },
      include: { mensagens: { orderBy: { timestamp: 'desc' }, take: 5 } },
    });
    if (!conversa) {
      conversa = await this.prisma.conversa.create({
        data: { clienteId: cliente.id },
        include: { mensagens: true },
      });
    }
    return conversa;
  }

  async processarMensagem(telefone: string, mensagem: string): Promise<string> {
    this.logger.log(`Processando mensagem de ${telefone}: "${mensagem}"`);

    let cliente = await this.prisma.cliente.findUnique({ where: { telefone } });
    if (!cliente) {
      cliente = await this.prisma.cliente.create({ data: { telefone } });
    }

    let conversa = await this.prisma.conversa.findFirst({
      where: { clienteId: cliente.id, status: { not: 'FINALIZADA' } },
      orderBy: { createdAt: 'desc' },
    });
    if (!conversa) {
      conversa = await this.prisma.conversa.create({
        data: { clienteId: cliente.id },
      });
    }

    await this.prisma.mensagem.create({
      data: { conversaId: conversa.id, origem: 'CLIENTE', conteudo: mensagem },
    });

    // ── BLOQUEIO: vendedor ja assumiu — IA nao responde mais ──────────────
    if (conversa.status === 'AGUARDANDO_HUMANO' || conversa.status === 'EM_ATENDIMENTO') {
      this.logger.log(`Conversa ${conversa.id} em atendimento humano — IA silenciosa`);
      return '';
    }

    // ── COLETA DE NOME: primeira mensagem sem nome salvo ─────────────────
    const contextoAtual = (conversa.contexto as Record<string, any>) || {};
    if (!cliente.nome && !contextoAtual.aguardandoNome && conversa.estadoAtual === 'INICIO') {
      await this.prisma.conversa.update({
        where: { id: conversa.id },
        data: { contexto: { ...contextoAtual, aguardandoNome: true } },
      });
      const resposta = 'Ola! Bem-vindo a nossa loja de autopecas! 😊\n\nPrimeiro, pode me dizer seu nome?';
      await this.prisma.mensagem.create({
        data: { conversaId: conversa.id, origem: 'IA', conteudo: resposta },
      });
      return resposta;
    }

    if (contextoAtual.aguardandoNome && !cliente.nome) {
      const nome = mensagem.trim().split(' ')[0];
      await this.prisma.cliente.update({
        where: { id: cliente.id },
        data: { nome: mensagem.trim() },
      });
      await this.prisma.conversa.update({
        where: { id: conversa.id },
        data: { contexto: { ...contextoAtual, aguardandoNome: false } },
      });
      cliente = { ...cliente, nome: mensagem.trim() };
      const resposta = `Prazer, ${nome}! 👋\n\nQual peca voce esta procurando? Me informe tambem o modelo e ano do veiculo.`;
      await this.prisma.mensagem.create({
        data: { conversaId: conversa.id, origem: 'IA', conteudo: resposta },
      });
      return resposta;
    }

    // ── FLUXO NORMAL ─────────────────────────────────────────────────────
    const historico = await this.buscarHistoricoTexto(conversa.id);
    const intencao = await this.aiService.classificarIntencao(mensagem, historico);
    this.logger.log(`Intent: ${intencao.intent} | Confianca: ${intencao.confianca} | Estado: ${conversa.estadoAtual}`);

    if (intencao.intent === 'falar_vendedor') {
      await this.handoffService.criarHandoff({
        conversaId: conversa.id,
        clienteId: cliente.id,
        telefone,
        resumo: `Cliente solicitou vendedor. Historico: ${historico}`,
        prioridade: 'ALTA',
        slaMinutos: 10,
      });
      await this.prisma.conversa.update({
        where: { id: conversa.id },
        data: { status: 'AGUARDANDO_HUMANO', estadoAtual: 'AGUARDANDO_VENDEDOR' },
      });
      const nomeCliente = cliente.nome ? `, ${cliente.nome.split(' ')[0]}` : '';
      return `Vou chamar um vendedor${nomeCliente}. Em ate 10 minutos alguem entrara em contato!`;
    }

    if (intencao.intent === 'saudacao') {
      const nomeCliente = cliente.nome ? `, ${cliente.nome.split(' ')[0]}` : '';
      return `Ola${nomeCliente}! Como posso te ajudar?\n\nQual peca voce esta procurando? Me informe tambem o modelo e ano do veiculo.`;
    }

    if (intencao.intent === 'desconhecido' || intencao.confianca < 0.6) {
      const mensagensCount = await this.prisma.mensagem.count({
        where: { conversaId: conversa.id, origem: 'CLIENTE' },
      });
      if (mensagensCount >= 3) {
        await this.handoffService.criarHandoff({
          conversaId: conversa.id,
          clienteId: cliente.id,
          telefone,
          resumo: `Multiplas mensagens sem resolucao. Ultima: "${mensagem}"`,
          prioridade: 'ALTA',
          slaMinutos: 15,
        });
        await this.prisma.conversa.update({
          where: { id: conversa.id },
          data: { status: 'AGUARDANDO_HUMANO', estadoAtual: 'AGUARDANDO_VENDEDOR' },
        });
        return 'Nao consegui entender. Vou chamar um vendedor para te ajudar!';
      }
      return 'Desculpe, nao entendi. Pode me dizer qual peca precisa e para qual veiculo?';
    }

    const ctx = {
      conversaId: conversa.id,
      clienteId: cliente.id,
      telefone,
      intent: intencao.intent,
      entidades: {
        peca: intencao.entidades.peca ?? undefined,
        veiculo: intencao.entidades.veiculo ?? undefined,
        ano: intencao.entidades.ano ?? undefined,
        pagamento: intencao.entidades.pagamento ?? undefined,
        entrega: intencao.entidades.tipo_atendimento ?? undefined,
        endereco: intencao.entidades.endereco ?? undefined,
      },
      estadoAtual: conversa.estadoAtual,
      contexto: conversa.contexto as Record<string, any>,
    };

    const resultado = await this.workflowEngine.executar(ctx);

    await this.prisma.mensagem.create({
      data: { conversaId: conversa.id, origem: 'IA', conteudo: resultado.resposta },
    });

    if (resultado.novoEstado === 'FINALIZADA') {
      await this.prisma.conversa.update({
        where: { id: conversa.id },
        data: { status: 'FINALIZADA', estadoAtual: 'FINALIZADA' },
      });
      return resultado.resposta;
    }

    if (resultado.handoff?.necessario) {
      const conversaAtualizada = await this.prisma.conversa.findUnique({
        where: { id: conversa.id },
        select: { contexto: true },
      });
      const ctxAtualizado = (conversaAtualizada?.contexto as Record<string, any>) || {};
      const carrinho: any[] = ctxAtualizado.carrinho || [];
      const pecasDoCarrinho = carrinho.map(i => i.nome).join(', ');

      await this.handoffService.criarHandoff({
        conversaId: conversa.id,
        clienteId: cliente.id,
        telefone,
        resumo: resultado.handoff.motivo ?? 'Handoff solicitado pelo workflow',
        peca: pecasDoCarrinho || ctx.entidades.peca,
        veiculo: ctxAtualizado.veiculo || ctx.entidades.veiculo,
        pagamento: ctxAtualizado.pagamento || ctx.entidades.pagamento,
        entrega: ctxAtualizado.tipoEntrega || ctx.entidades.entrega,
        prioridade: resultado.handoff.prioridade ?? 'MEDIA',
        slaMinutos: 30,
      });
      await this.prisma.conversa.update({
        where: { id: conversa.id },
        data: { status: 'AGUARDANDO_HUMANO' },
      });
    }

    return resultado.resposta;
  }

  private async buscarHistoricoTexto(conversaId: string): Promise<string> {
    const mensagens = await this.prisma.mensagem.findMany({
      where: { conversaId },
      orderBy: { timestamp: 'desc' },
      take: 6,
    });
    return mensagens
      .reverse()
      .map(m => `${m.origem === 'CLIENTE' ? 'Cliente' : 'Bot'}: ${m.conteudo}`)
      .join('\n');
  }
}
