import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from './whatsapp.service';

@Injectable()
export class InatividadeService {
  private readonly logger = new Logger(InatividadeService.name);

  private readonly TEMPO_LEMBRETE_MS = 3 * 60 * 1000;
  private readonly TEMPO_ENCERRAR_MS = 8 * 60 * 1000;

  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsappService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async verificarConversasInativas(): Promise<void> {
    const agora = new Date();

    const conversas = await this.prisma.conversa.findMany({
      where: {
        status: 'ATIVA',
        estadoAtual: { notIn: ['INICIO', 'FINALIZADO', 'FINALIZADA'] },
      },
      include: {
        cliente: true,
        mensagens: {
          where: { origem: 'CLIENTE' },
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });

    for (const conversa of conversas) {
      const ultimaMsgCliente = conversa.mensagens[0];
      if (!ultimaMsgCliente) continue;

      const inatividade = agora.getTime() - ultimaMsgCliente.timestamp.getTime();
      const contexto = conversa.contexto as Record<string, any>;
      const lembreteEnviado = contexto.lembreteInatividade === true;

      if (inatividade >= this.TEMPO_ENCERRAR_MS) {
        this.logger.log(`Encerrando conversa ${conversa.id} por inatividade`);

        const msg = 'Encerrando seu atendimento por inatividade. Quando precisar e so chamar! Ate logo 👋';

        await this.whatsapp.enviarMensagem(conversa.cliente.telefone, msg);

        await this.prisma.mensagem.create({
          data: { conversaId: conversa.id, origem: 'SISTEMA', conteudo: msg },
        });

        await this.prisma.conversa.update({
          where: { id: conversa.id },
          data: {
            status: 'EXPIRADA',
            estadoAtual: 'FINALIZADA',
            contexto: { ...contexto, lembreteInatividade: false },
          },
        });

        continue;
      }

      if (inatividade >= this.TEMPO_LEMBRETE_MS && !lembreteEnviado) {
        this.logger.log(`Lembrete de inatividade para conversa ${conversa.id}`);

        const msg = 'Oi! Ainda estou aqui caso precise de ajuda 😊 Pode continuar quando quiser!';

        await this.whatsapp.enviarMensagem(conversa.cliente.telefone, msg);

        await this.prisma.mensagem.create({
          data: { conversaId: conversa.id, origem: 'SISTEMA', conteudo: msg },
        });

        await this.prisma.conversa.update({
          where: { id: conversa.id },
          data: { contexto: { ...contexto, lembreteInatividade: true } },
        });
      }
    }
  }
}