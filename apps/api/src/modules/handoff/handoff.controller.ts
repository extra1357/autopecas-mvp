import {
  Controller, Get, Post, Param, Body,
  Inject, forwardRef, Sse, MessageEvent,
  Header, HttpCode, HttpStatus, ConflictException,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { HandoffService } from './handoff.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('handoff')
export class HandoffController {
  constructor(
    private readonly handoffService: HandoffService,
    @Inject(forwardRef(() => WhatsappService))
    private readonly whatsappService: WhatsappService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GET /api/handoff/stream
   * Endpoint SSE — o dashboard se conecta uma única vez e recebe eventos em tempo real.
   * Substitui o setInterval de 8s no frontend.
   *
   * Eventos emitidos:
   *   { tipo: 'novo',     atendimentoId: string }  — novo handoff chegou
   *   { tipo: 'assumido', atendimentoId: string }  — alguém assumiu
   *   { tipo: 'resolvido',atendimentoId: string }  — atendimento encerrado
   */
  @Sse('stream')
  @Header('X-Accel-Buffering', 'no') // impede Nginx/proxies de bufferar o stream
  stream(): Observable<MessageEvent> {
    return this.handoffService.getSseStream().pipe(
      map((evento) => ({
        data: JSON.stringify(evento),
        type: evento.tipo,
        id: evento.atendimentoId,
      })),
    );
  }

  @Get('pendentes')
  listarPendentes() {
    return this.handoffService.listarPendentes();
  }

  /**
   * POST /api/handoff/:id/assumir
   * Retorna 409 se outro vendedor já assumiu (lock otimista no service).
   * O frontend trata o 409 exibindo toast e recarregando a lista.
   */
  @Post(':id/assumir')
  async assumir(
    @Param('id') id: string,
    @Body() body: { vendedorId: string },
  ) {
    return this.handoffService.assumirAtendimento(id, body.vendedorId);
  }

  @Post(':id/resolver')
  resolver(@Param('id') id: string) {
    return this.handoffService.resolverAtendimento(id);
  }

  @Post(':id/mensagem')
  async enviarMensagem(
    @Param('id') id: string,
    @Body() body: { texto: string; vendedorId: string },
  ) {
    const atendimento = await this.prisma.atendimento.findUnique({
      where: { id },
      include: { conversa: { include: { cliente: true } } },
    });
    if (!atendimento) return { erro: 'Atendimento nao encontrado' };
    if (atendimento.status !== 'EM_ANDAMENTO') return { erro: 'Atendimento nao esta em andamento' };

    const telefone = atendimento.conversa.cliente.telefone;
    await this.whatsappService.enviarMensagem(telefone, body.texto);
    await this.prisma.mensagem.create({
      data: {
        conversaId: atendimento.conversaId,
        origem: 'HUMANO',
        conteudo: body.texto,
        metadata: { vendedorId: body.vendedorId },
      },
    });
    return { status: 'ok', enviado: true };
  }
}