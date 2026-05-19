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
    private ai: AiService,
    private workflowEngine: WorkflowEngine,
    private handoffService: HandoffService,
  ) {}

  async processarMensagem(telefone: string, mensagem: string): Promise<string> {
    // 1. Busca ou cria cliente
    const cliente = await this.prisma.cliente.upsert({
      where: { telefone },
      update: {},
      create: { telefone },
    });

    // 2. Busca ou cria conversa ativa
    let conversa = await this.prisma.conversa.findFirst({
      where: {
        clienteId: cliente.id,
        status: { in: ['ATIVA', 'AGUARDANDO_HUMANO'] },
      },
      include: {
        mensagens: { orderBy: { timestamp: 'desc' }, take: 5 },
      },
    });

    if (!conversa) {
      conversa = await this.prisma.conversa.create({
        data: { clienteId: cliente.id, contexto: {} },
        include: { mensagens: { orderBy: { timestamp: 'desc' }, take: 5 } },
      });
      this.logger.log(`Nova conversa criada: ${conversa.id} para ${telefone}`);
    }

    // 3. Salva mensagem do cliente
    await this.prisma.mensagem.create({
      data: { conversaId: conversa.id, origem: 'CLIENTE', conteudo: mensagem },
    });

    // 4. Monta histórico para contexto da IA
    const historico = conversa.mensagens
      .reverse()
      .map(m => `${m.origem}: ${m.conteudo}`);

    // 5. Classifica intent com IA
    const intentResult = await this.ai.classificarMensagem(mensagem, historico);

    // 6. Resposta direta para saudações/despedidas
    if (intentResult.resposta_direta && intentResult.confianca > 0.8) {
      await this.prisma.mensagem.create({
        data: { conversaId: conversa.id, origem: 'IA', conteudo: intentResult.resposta_direta },
      });
      return intentResult.resposta_direta;
    }

    // 7. Handoff direto se cliente pediu vendedor
    if (intentResult.intent === 'falar_vendedor') {
      const resposta = 'Claro! Vou chamar um atendente agora. Aguarde um momento! 👨‍💼';

      await this.prisma.mensagem.create({
        data: { conversaId: conversa.id, origem: 'IA', conteudo: resposta },
      });

      await this.handoffService.criarHandoff({
        conversaId: conversa.id,
        clienteId: cliente.id,
        telefone,
        resumo: `Cliente solicitou atendente. Contexto: ${mensagem}`,
        prioridade: 'MEDIA',
        slaMinutos: 15,
        ...intentResult.entidades,
      });

      return resposta;
    }

    // 8. Executa workflow
    const ctx = conversa.contexto as Record<string, any>;
    const workflowResult = await this.workflowEngine.executar({
      conversaId: conversa.id,
      clienteId: cliente.id,
      telefone,
      intent: intentResult.intent,
      entidades: intentResult.entidades,
      estadoAtual: conversa.estadoAtual,
      contexto: ctx,
    });

    // 9. Salva resposta da IA
    await this.prisma.mensagem.create({
      data: { conversaId: conversa.id, origem: 'IA', conteudo: workflowResult.resposta },
    });

    // 10. Cria handoff se necessário
    if (workflowResult.handoff?.necessario) {
      await this.handoffService.criarHandoff({
        conversaId: conversa.id,
        clienteId: cliente.id,
        telefone,
        resumo: workflowResult.handoff.motivo || 'Handoff automático',
        prioridade: workflowResult.handoff.prioridade || 'MEDIA',
        slaMinutos: 30,
        ...intentResult.entidades,
      });
    }

    return workflowResult.resposta;
  }

  async buscarOuCriarConversa(telefone: string) {
    const cliente = await this.prisma.cliente.upsert({
      where: { telefone },
      update: {},
      create: { telefone },
    });

    return this.prisma.conversa.findFirst({
      where: { clienteId: cliente.id, status: { in: ['ATIVA', 'AGUARDANDO_HUMANO'] } },
      include: { mensagens: { orderBy: { timestamp: 'asc' } }, cliente: true },
    });
  }
}
