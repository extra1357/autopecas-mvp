import { Controller, Get, Patch, Param } from '@nestjs/common';
import { RagService } from './rag.service';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Get('perguntas-sem-resposta')
  async listar() {
    return this.ragService.listarPerguntasSemResposta();
  }

  @Patch('perguntas-sem-resposta/:id/resolver')
  async resolver(@Param('id') id: string) {
    return this.ragService.marcarResolvida(id);
  }
}
