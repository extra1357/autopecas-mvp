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

  async buscarConhecimento(pergunta: string): Promise<string | null> {
    const palavras = pergunta.toLowerCase().split(' ').filter(p => p.length > 3);

    const chunks = await this.prisma.baseConhecimento.findMany({
      where: {
        OR: [
          { conteudo: { contains: pergunta, mode: 'insensitive' } },
          { titulo: { contains: pergunta, mode: 'insensitive' } },
          ...(palavras.length > 0 ? [{ tags: { hasSome: palavras } }] : []),
        ],
      },
      take: 3,
      orderBy: { relevancia: 'desc' },
    });

    if (chunks.length === 0) return null;

    const contexto = chunks.map(c => `${c.titulo}:\n${c.conteudo}`).join('\n\n');

    try {
      const completion = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'user',
            content: `Voce e o atendente virtual de uma loja de autopecas brasileira.
Use APENAS as informacoes abaixo para responder a pergunta do cliente.
Se a resposta nao estiver nas informacoes, retorne exatamente: NAO_ENCONTRADO

Informacoes da loja:
${contexto}

Pergunta do cliente: "${pergunta}"

Responda de forma direta e amigavel, em ate 3 linhas. Sem introducoes como "Claro!" ou "Olha,".`,
          },
        ],
        temperature: 0.2,
        max_tokens: 200,
      });

      const resposta = completion.choices[0]?.message?.content?.trim() ?? '';
      if (resposta === 'NAO_ENCONTRADO' || resposta === '') return null;
      return resposta;
    } catch (err) {
      this.logger.error('Erro no RagService:', err);
      return null;
    }
  }
}
