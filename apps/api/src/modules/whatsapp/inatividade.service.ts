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
    this.logger.log('[Inatividade] Cron iniciado');
    const agora = new Date();

    let conversas: any[];
    try {
      conversas = await this.prisma.conversa.findMany({
        where: {
          status: 'ATIVA',
          estadoAtual: { notIn: ['INICIO', 'FINALIZADO', 'FINALIZADA'] },
        },
        include: {
          cliente: true,
          mensagens: { where: { origem: 'CLIENTE' }, orderBy: { timestamp: 'desc' }, take: 1 },
        },
      });
    } catch (error) {
      this.logger.error(`[Inatividade] ❌ Falha ao buscar conversas ativas | erro=${error.message}`);
      return;
    }

    this.logger.log(`[Inatividade] ${conversas.length} conversa(s) ativa(s) verificada(s)`);

    for (const conversa of conversas) {
      try {
        const ultimaMsgCliente = conversa.mensagens[0];
        if (!ultimaMsgCliente) {
          this.logger.warn(`[Inatividade] Conversa ${conversa.id} sem mensagens do cliente — ignorando`);
          continue;
        }

        const inatividade = agora.getTime() - ultimaMsgCliente.timestamp.getTime();
        const contexto = conversa.contexto as Record<string, any>;
        const lembreteEnviado = contexto?.lembreteInatividade === true;

        if (inatividade >= this.TEMPO_ENCERRAR_MS) {
          this.logger.log(`[Inatividade] Encerrando conversa ${conversa.id} | inatividade=${Math.round(inatividade / 1000)}s`);
          const msg = 'Encerrando seu atendimento por inatividade. Quando precisar e so chamar! Ate logo 👋';
          await this.whatsapp.enviarMensagem(conversa.cliente.telefone, msg);
          await this.prisma.mensagem.create({ data: { conversaId: conversa.id, origem: 'SISTEMA', conteudo: msg } });
          await this.prisma.conversa.update({
            where: { id: conversa.id },
            data: { status: 'EXPIRADA', estadoAtual: 'FINALIZADA', contexto: { ...contexto, lembreteInatividade: false } },
          });
          this.logger.log(`[Inatividade] ✅ Conversa ${conversa.id} encerrada`);
          continue;
        }

        if (inatividade >= this.TEMPO_LEMBRETE_MS && !lembreteEnviado) {
          this.logger.log(`[Inatividade] Enviando lembrete para conversa ${conversa.id} | inatividade=${Math.round(inatividade / 1000)}s`);
          const msg = 'Oi! Ainda estou aqui caso precise de ajuda 😊 Pode continuar quando quiser!';
          await this.whatsapp.enviarMensagem(conversa.cliente.telefone, msg);
          await this.prisma.mensagem.create({ data: { conversaId: conversa.id, origem: 'SISTEMA', conteudo: msg } });
          await this.prisma.conversa.update({
            where: { id: conversa.id },
            data: { contexto: { ...contexto, lembreteInatividade: true } },
          });
          this.logger.log(`[Inatividade] ✅ Lembrete enviado para conversa ${conversa.id}`);
        }
      } catch (error) {
        this.logger.error(`[Inatividade] ❌ Erro ao processar conversa ${conversa.id} | erro=${error.message}`);
        // Continua para a próxima conversa sem travar o cron
      }
    }

    this.logger.log('[Inatividade] Cron finalizado');
  }
}
