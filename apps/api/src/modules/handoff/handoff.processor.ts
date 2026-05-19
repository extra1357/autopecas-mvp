import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';

@Processor('handoff')
export class HandoffProcessor {
  constructor(private prisma: PrismaService) {}

  @Process('novo-handoff')
  async processarNovoHandoff(job: Job) {
    const { atendimentoId, telefone, resumo, prioridade } = job.data;

    console.log(`\n🔔 [Handoff] NOVO ATENDIMENTO`);
    console.log(`   ID: ${atendimentoId}`);
    console.log(`   Cliente: ${telefone}`);
    console.log(`   Resumo: ${resumo}`);
    console.log(`   Prioridade: ${prioridade}`);
    console.log(`   ⚡ Vendedor deve ser notificado agora!\n`);

    await this.prisma.logConversa.create({
      data: {
        conversaId: job.data.conversaId,
        tipo: 'HANDOFF_NOTIFICADO',
        payload: { atendimentoId, prioridade, timestamp: new Date() },
      },
    });

    return { processado: true };
  }

  @Process('verificar-sla')
  async verificarSla(job: Job) {
    const { atendimentoId, conversaId } = job.data;

    const atendimento = await this.prisma.atendimento.findUnique({
      where: { id: atendimentoId },
    });

    if (!atendimento || atendimento.status !== 'PENDENTE') return;

    console.warn(`\n⚠️  [SLA] ATENDIMENTO ${atendimentoId} NÃO FOI ASSUMIDO NO PRAZO!`);

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
  }
}
