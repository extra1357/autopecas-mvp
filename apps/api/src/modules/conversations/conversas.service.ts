import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { WorkflowEngine } from '../workflows/workflow.engine';
import { HandoffService } from '../handoff/handoff.service';

const INTENTS_WORKFLOW = ['buscar_peca', 'consultar_preco', 'consultar_estoque', 'entrega', 'retirada', 'status_pedido'];
const INTENTS_DIRETAS = ['saudacao', 'outro'];

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
    const cliente = await this.prisma.cliente.upsert({
      where: { telefone },
      update: {},
      create: { telefone },
    });

    let conversa = await this.prisma.conversa.findFirst({
      where: { clienteId: cliente.id, status: { in: ['ATIVA', 'AGUARDANDO_HUMANO'] } },
      include: { mensagens: { orderBy: { timestamp: 'desc' }, take: 5 } },
    });

    if (!conversa) {
      conversa = await this.prisma.conversa.create({
        data: { clienteId: cliente.id, contexto: {} },
        include: { mensagens: { orderBy: { timestamp: 'desc' }, take: 5 } },
      });
      this.logger.log(`Nova conversa: ${conversa.id} para ${telefone}`);
    }

    await this.prisma.mensagem.create({
      data: { conversaId: conversa.id, origem: 'CLIENTE', conteudo: mensagem },
    });

    const historico = conversa.mensagens.reverse().map(m => `${m.origem}: ${m.conteudo}`);
    const intentResult = await this.ai.processarMensagem(mensagem, historico);
    this.logger.log(`Intent: ${intentResult.intent} | Confianca: ${intentResult.confianca}`);

    let resposta: string;

    if (intentResult.intent === 'falar_vendedor') {
      resposta = 'Claro! Vou chamar um atendente agora. Aguarde um momento!';
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

    if (INTENTS_DIRETAS.includes(intentResult.intent)) {
      resposta = intentResult.resposta || 'Como posso ajudar?';
      await this.prisma.mensagem.create({
        data: { conversaId: conversa.id, origem: 'IA', conteudo: resposta },
      });
      return resposta;
    }

    if (INTENTS_WORKFLOW.includes(intentResult.intent)) {
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

      await this.prisma.mensagem.create({
        data: { conversaId: conversa.id, origem: 'IA', conteudo: workflowResult.resposta },
      });

      if (workflowResult.handoff?.necessario) {
        await this.handoffService.criarHandoff({
          conversaId: conversa.id,
          clienteId: cliente.id,
          telefone,
          resumo: workflowResult.handoff.motivo || 'Handoff automatico',
          prioridade: workflowResult.handoff.prioridade || 'MEDIA',
          slaMinutos: 30,
          ...intentResult.entidades,
        });
      }

      return workflowResult.resposta;
    }

    resposta = intentResult.resposta || 'Pode me dar mais detalhes?';
    await this.prisma.mensagem.create({
      data: { conversaId: conversa.id, origem: 'IA', conteudo: resposta },
    });
    return resposta;
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
