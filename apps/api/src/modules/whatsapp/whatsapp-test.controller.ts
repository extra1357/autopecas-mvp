import { Controller, Post, Body } from '@nestjs/common';
import { ConversasService } from '../conversations/conversas.service';

@Controller('test')
export class WhatsappTestController {
  constructor(private readonly conversasService: ConversasService) {}

  @Post('mensagem')
  async testarMensagem(@Body() body: { telefone: string; mensagem: string }) {
    const { telefone, mensagem } = body;
    const resposta = await this.conversasService.processarMensagem(telefone, mensagem);
    return { resposta };
  }
}
