import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';

export interface HandoffPayload {
  conversaId: string;
  clienteId: string;
  telefone: string;
  resumo: string;
  peca?: string;
  veiculo?: string;
  pagamento?: string;
  entrega?: string;
  prioridade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';
  slaMinutos: number;
}

@Injectable()
export class HandoffService {
  constructor(
    @InjectQueue('handoff') private handoffQueue: Queue,
    private prisma: PrismaService,
  ) {}

  async criarHandoff(payload: HandoffPayload) {
    // Verifica se já existe handoff pendente para essa conversa
    const existente = await this.prisma.atendimento.findUnique({
      where: { conversaId: payload.conversaId },
    });

    if (existente && existente.status === 'PENDENTE') {
      console.log(`[Handoff] Já existe handoff pendente para conversa ${payload.conversaId}`);
      return existente;
    }

    // Cria atendimento no banco
    const atendimento = await this.prisma.atendimento.create({
      data: {
        conversaId: payload.conversaId,
        status: 'PENDENTE',
        prioridade: payload.prioridade,
        slaMinutos: payload.slaMinutos,
        resumo: this.montarResumo(payload),
      },
    });

    // Enfileira job com delay para SLA
    await this.handoffQueue.add(
      'novo-handoff',
      { atendimentoId: atendimento.id, ...payload },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: false,
        removeOnFail: false,
      },
    );

    // Job de SLA — dispara se não for atendido no prazo
    await this.handoffQueue.add(
      'verificar-sla',
      { atendimentoId: atendimento.id, conversaId: payload.conversaId },
      {
        delay: payload.slaMinutos * 60 * 1000,
        attempts: 1,
        removeOnComplete: true,
      },
    );

    console.log(`[Handoff] Criado atendimento ${atendimento.id} — prioridade: ${payload.prioridade}`);
    return atendimento;
  }

  async assumirAtendimento(atendimentoId: string, vendedorId: string) {
    const atendimento = await this.prisma.atendimento.update({
      where: { id: atendimentoId },
      data: {
        vendedorId,
        status: 'EM_ANDAMENTO',
        iniciadoEm: new Date(),
      },
      include: { conversa: { include: { cliente: true } } },
    });

    await this.prisma.conversa.update({
      where: { id: atendimento.conversaId },
      data: { status: 'EM_ATENDIMENTO' },
    });

    await this.prisma.logConversa.create({
      data: {
        conversaId: atendimento.conversaId,
        tipo: 'HANDOFF_ASSUMIDO',
        payload: { vendedorId, atendimentoId },
      },
    });

    return atendimento;
  }

  async resolverAtendimento(atendimentoId: string) {
    const atendimento = await this.prisma.atendimento.update({
      where: { id: atendimentoId },
      data: {
        status: 'RESOLVIDO',
        resolvidoEm: new Date(),
      },
    });

    await this.prisma.conversa.update({
      where: { id: atendimento.conversaId },
      data: {
        status: 'FINALIZADA',
        estadoAtual: 'FINALIZADO',
      },
    });

    return atendimento;
  }

  async listarPendentes() {
    return this.prisma.atendimento.findMany({
      where: { status: { in: ['PENDENTE', 'EM_ANDAMENTO'] } },
      include: {
        conversa: {
          include: { cliente: true, mensagens: { orderBy: { timestamp: 'desc' }, take: 3 } },
        },
      },
      orderBy: [
        { prioridade: 'desc' },
        { createdAt: 'asc' },
      ],
    });
  }

  private montarResumo(payload: HandoffPayload): string {
    const linhas = [`Cliente: ${payload.telefone}`];
    if (payload.peca) linhas.push(`Peça: ${payload.peca}`);
    if (payload.veiculo) linhas.push(`Veículo: ${payload.veiculo}`);
    if (payload.pagamento) linhas.push(`Pagamento: ${payload.pagamento}`);
    if (payload.entrega) linhas.push(`Entrega: ${payload.entrega}`);
    return linhas.join(' | ');
  }

  calcularPrioridade(contexto: Record<string, any>): 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE' {
    if (contexto.pagamento) return 'ALTA';
    if (contexto.peca && contexto.veiculo) return 'MEDIA';
    return 'BAIXA';
  }
}
