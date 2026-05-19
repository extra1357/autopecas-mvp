import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { HandoffService } from './handoff.service';

@Controller('handoff')
export class HandoffController {
  constructor(private readonly handoffService: HandoffService) {}

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
}
