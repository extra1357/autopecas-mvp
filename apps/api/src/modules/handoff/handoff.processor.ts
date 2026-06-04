import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';

@Processor('handoff')
export class HandoffProcessor {
  private readonly logger = new Logger(HandoffProcessor.name);

  constructor(private prisma: PrismaService) {}

  @Process('novo-handoff')
  async processarNovoHandoff(job: Job) {
    const { atendimentoId, conversaId, telefone, resumo, prioridade } = job.data;
    this.logger.log(`[Handoff] Processando job ${job.id} | atendimento=${atendimentoId} | telefone=${telefone} | prioridade=${prioridade}`);

    try {
      await this.prisma.logConversa.create({
        data: {
          conversaId,
          tipo: 'HANDOFF_NOTIFICADO',
          payload: { atendimentoId, prioridade, timestamp: new Date() },
        },
      });
      this.logger.log(`[Handoff] ✅ Log HANDOFF_NOTIFICADO criado para atendimento=${atendimentoId}`);
    } catch (error) {
      this.logger.error(`[Handoff] ❌ Falha ao criar log para atendimento=${atendimentoId} | erro=${error.message}`);
      throw error; // Bull vai retentar o job
    }

    return { processado: true };
  }

  @Process('verificar-sla')
  async verificarSla(job: Job) {
    const { atendimentoId, conversaId } = job.data;
    this.logger.log(`[SLA] Verificando atendimento=${atendimentoId}`);

    try {
      const atendimento = await this.prisma.atendimento.findUnique({ where: { id: atendimentoId } });

      if (!atendimento) {
        this.logger.warn(`[SLA] Atendimento ${atendimentoId} não encontrado — pode ter sido removido`);
        return;
      }

      if (atendimento.status !== 'PENDENTE') {
        this.logger.log(`[SLA] Atendimento ${atendimentoId} já foi assumido (status=${atendimento.status}) — SLA ok`);
        return;
      }

      this.logger.warn(`[SLA] ⚠️ Atendimento ${atendimentoId} NÃO assumido no prazo — escalando para URGENTE`);

      await this.prisma.atendimento.update({
        where: { id: atendimentoId },
        data: { prioridade: 'URGENTE' },
      });

      await this.prisma.logConversa.create({
        data: {
          conversaId,
          tipo: 'SLA_VIOLADO',
          payload: { atendimentoId, timestamp: new Date() },
        },
      });

      this.logger.warn(`[SLA] ✅ SLA_VIOLADO registrado para atendimento=${atendimentoId}`);
    } catch (error) {
      this.logger.error(`[SLA] ❌ Erro ao verificar SLA do atendimento=${atendimentoId} | erro=${error.message}`);
      throw error;
    }
  }
}
