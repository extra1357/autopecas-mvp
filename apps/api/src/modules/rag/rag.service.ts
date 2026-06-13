import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Groq from 'groq-sdk';

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private groq: Groq;

  constructor(private prisma: PrismaService) {
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }

  async buscarConhecimento(pergunta: string, conversaId?: string): Promise<string | null> {
    const chunks = await this.prisma.baseConhecimento.findMany({
      where: {
        OR: [
          { conteudo: { contains: pergunta, mode: 'insensitive' } },
          { tags: { hasSome: pergunta.toLowerCase().split(' ').filter(p => p.length > 3) } },
        ],
      },
      take: 3,
      orderBy: { relevancia: 'desc' },
    });

    if (chunks.length === 0) {
      // MODULO 4 — Registra pergunta sem resposta para analise
      await this.prisma.perguntaSemResposta.create({
        data: {
          pergunta,
          conversaId: conversaId ?? null,
        },
      });
      this.logger.warn(`Pergunta sem resposta registrada: "${pergunta}"`);
      return null;
    }

    const contexto = chunks.map(c => c.conteudo).join('\n\n');

    const completion = await this.groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'user',
          content: `Voce e o atendente virtual de uma loja de autopecas.
Use APENAS as informacoes abaixo para responder.
Se a resposta nao estiver nas informacoes, diga que vai verificar com um vendedor.

Informacoes da loja:
${contexto}

Pergunta do cliente: "${pergunta}"

Responda de forma direta e amigavel, em ate 3 linhas.`,
        },
      ],
      temperature: 0.2,
      max_tokens: 200,
    });

    return completion.choices[0]?.message?.content?.trim() ?? null;
  }

  async listarPerguntasSemResposta() {
    return this.prisma.perguntaSemResposta.findMany({
      where: { resolvida: false },
      orderBy: { criadoEm: 'desc' },
      take: 50,
    });
  }

  async marcarResolvida(id: string) {
    return this.prisma.perguntaSemResposta.update({
      where: { id },
      data: { resolvida: true },
    });
  }
}
