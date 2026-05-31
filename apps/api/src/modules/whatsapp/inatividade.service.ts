import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class InatividadeService {
  private readonly logger = new Logger(InatividadeService.name);

  // Tempos em milissegundos
  private readonly TEMPO_LEMBRETE_MS = 3 * 60 * 1000;  // 3 minutos
  private readonly TEMPO_ENCERRAR_MS = 8 * 60 * 1000;  // 8 minutos

  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsappService,
  ) {}

  async verificarConversasInativas(): Promise<void> {
    const agora = new Date();

    // Busca conversas ativas (exclui as que ja estao aguardando humano/finalizadas)
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

      // Passou 8 min → encerra
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

      // Passou 3 min e ainda nao enviou lembrete → envia
      if (inatividade >= this.TEMPO_LEMBRETE_MS && !lembreteEnviado) {
        this.logger.log(`Enviando lembrete de inatividade para conversa ${conversa.id}`);

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