import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface WorkflowContext {
  conversaId: string;
  clienteId: string;
  telefone: string;
  intent: string;
  entidades: {
    peca?: string;
    veiculo?: string;
    ano?: string;
    marca?: string;
    pagamento?: string;
    entrega?: string;
    endereco?: string;
  };
  estadoAtual: string;
  contexto: Record<string, any>;
}

export interface WorkflowResult {
  resposta: string;
  novoEstado: string;
  acoes: string[];
  handoff?: {
    necessario: boolean;
    motivo?: string;
    prioridade?: 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';
  };
}

export interface Workflow {
  nome: string;
  intents: string[];
  executar(ctx: WorkflowContext, prisma: PrismaService): Promise<WorkflowResult>;
}

@Injectable()
export class WorkflowEngine {
  private readonly logger = new Logger(WorkflowEngine.name);
  private workflows: Map<string, Workflow> = new Map();

  constructor(private prisma: PrismaService) {}

  registrar(workflow: Workflow) {
    for (const intent of workflow.intents) {
      this.workflows.set(intent, workflow);
      this.logger.log(`Workflow registrado: ${workflow.nome} â†’ intent: ${intent}`);
    }
  }

  async executar(ctx: WorkflowContext): Promise<WorkflowResult> {
    const workflow = this.workflows.get(ctx.intent);

    if (!workflow) {
      this.logger.warn(`Nenhum workflow para intent: ${ctx.intent}`);
      return {
        resposta: 'Entendi! Pode me dar mais detalhes sobre o que vocÃª precisa?',
        novoEstado: ctx.estadoAtual,
        acoes: [],
        handoff: { necessario: false },
      };
    }

    this.logger.log(`Executando workflow: ${workflow.nome} para conversa ${ctx.conversaId}`);

    try {
      const result = await workflow.executar(ctx, this.prisma);

      // Persiste novo estado na conversa
      await this.prisma.conversa.update({
        where: { id: ctx.conversaId },
        data: {
          estadoAtual: result.novoEstado as any,
          contexto: {
            ...ctx.contexto,
            ...ctx.entidades,
            intent: ctx.intent,
            ultimaAcao: result.acoes[result.acoes.length - 1],
          },
        },
      });

      // Loga a transiÃ§Ã£o
      await this.prisma.logConversa.create({
        data: {
          conversaId: ctx.conversaId,
          tipo: 'WORKFLOW_EXECUTADO',
          payload: {
            workflow: workflow.nome,
            intent: ctx.intent,
            estadoAnterior: ctx.estadoAtual,
            novoEstado: result.novoEstado,
            acoes: result.acoes,
            handoff: result.handoff,
          },
        },
      });

      return result;
    } catch (err) {
      this.logger.error(`Erro no workflow ${workflow.nome}: ${err.message}`);

      await this.prisma.logConversa.create({
        data: {
          conversaId: ctx.conversaId,
          tipo: 'WORKFLOW_ERRO',
          payload: { workflow: workflow.nome, erro: err.message },
        },
      });

      return {
        resposta: 'Tive um problema interno. Um atendente vai te ajudar em breve.',
        novoEstado: 'AGUARDANDO_VENDEDOR',
        acoes: ['ERRO_INTERNO'],
        handoff: { necessario: true, motivo: `Erro no workflow: ${err.message}`, prioridade: 'ALTA' },
      };
    }
  }
}
