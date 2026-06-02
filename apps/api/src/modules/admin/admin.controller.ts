import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface VendedorStat {
  codigo: string;
  finalizadas: number;
  abandonadas: number;
  total: number;
}

@Controller('admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('metricas')
  async getMetricas(@Query('mes') mes?: string) {
    const agora = new Date();
    const inicioMes = mes
      ? new Date(mes)
      : new Date(agora.getFullYear(), agora.getMonth(), 1);
    const fimMes = new Date(inicioMes.getFullYear(), inicioMes.getMonth() + 1, 0, 23, 59, 59);

    const totalLeads = await this.prisma.conversa.count({
      where: { createdAt: { gte: inicioMes, lte: fimMes } },
    });

    const atendidosIA = await this.prisma.conversa.count({
      where: {
        createdAt: { gte: inicioMes, lte: fimMes },
        mensagens: { some: { origem: 'IA' } },
      },
    });

    const abandonados = await this.prisma.conversa.count({
      where: {
        createdAt: { gte: inicioMes, lte: fimMes },
        status: 'FINALIZADA',
        mensagens: { none: { origem: { in: ['IA', 'HUMANO'] } } },
      },
    });

    const handoffs = await this.prisma.atendimento.findMany({
      where: { createdAt: { gte: inicioMes, lte: fimMes } },
    });

    const vendaFinalizada = handoffs.filter((h) => h.status === 'RESOLVIDO');
    const vendaAbandonada = handoffs.filter((h) => h.status === 'EXPIRADO');

    const porVendedor: Record<string, VendedorStat> = {};

    for (const h of handoffs) {
      const codigo = (h.vendedorId ?? 'SEM').slice(0, 3).toUpperCase();
      if (!porVendedor[codigo]) {
        porVendedor[codigo] = { codigo, finalizadas: 0, abandonadas: 0, total: 0 };
      }
      porVendedor[codigo].total += 1;
      if (h.status === 'RESOLVIDO') porVendedor[codigo].finalizadas += 1;
      if (h.status === 'EXPIRADO') porVendedor[codigo].abandonadas += 1;
    }

    const ticketMedio = 350;
    const minutosEconomizadosPorLead = 5;
    const horasEconomizadas = Math.round((atendidosIA * minutosEconomizadosPorLead) / 60);
    const receitaGerada = vendaFinalizada.length * ticketMedio;
    const taxaConversao = totalLeads > 0 ? parseFloat(((vendaFinalizada.length / totalLeads) * 100).toFixed(1)) : 0;
    const taxaAtendimento = totalLeads > 0 ? parseFloat(((atendidosIA / totalLeads) * 100).toFixed(1)) : 0;
    const taxaAbandono = totalLeads > 0 ? parseFloat(((abandonados / totalLeads) * 100).toFixed(1)) : 0;

    return {
      periodo: { inicio: inicioMes, fim: fimMes },
      leads: { total: totalLeads, atendidosIA, abandonados, taxaAtendimento, taxaAbandono },
      vendas: { finalizadas: vendaFinalizada.length, abandonadas: vendaAbandonada.length, taxaConversao, receitaGerada, ticketMedio },
      eficiencia: { horasEconomizadas, minutosEconomizadosPorLead },
      vendedores: Object.values(porVendedor).sort((a, b) => b.finalizadas - a.finalizadas),
    };
  }
}
