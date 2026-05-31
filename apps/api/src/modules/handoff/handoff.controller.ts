import { Controller, Get, Post, Param, Body, Inject, forwardRef } from '@nestjs/common';
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

  @Get('pendentes')
  listarPendentes() {
    return this.handoffService.listarPendentes();
  }

  @Post(':id/assumir')
  assumir(@Param('id') id: string, @Body() body: { vendedorId: string }) {
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

    if (!atendimento) {
      return { erro: 'Atendimento nao encontrado' };
    }

    if (atendimento.status !== 'EM_ANDAMENTO') {
      return { erro: 'Atendimento nao esta em andamento' };
    }

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
