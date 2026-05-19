import { Controller, Get, Param } from '@nestjs/common';
import { ConversasService } from './conversas.service';

@Controller('conversas')
export class ConversasController {
  constructor(private readonly conversasService: ConversasService) {}

  @Get('cliente/:telefone')
  async buscarPorTelefone(@Param('telefone') telefone: string) {
    return this.conversasService.buscarOuCriarConversa(telefone);
  }
}
