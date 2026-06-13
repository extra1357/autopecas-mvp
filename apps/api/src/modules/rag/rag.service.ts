import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Groq from 'groq-sdk';
import { HfInference } from '@huggingface/inference';

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private groq: Groq;
  private hf: HfInference;

  constructor(private prisma: PrismaService) {
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    this.hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
  }

  private async gerarEmbedding(texto: string): Promise<number[]> {
    const result = await this.hf.featureExtraction({
      model: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
      inputs: texto,
    });
    return Array.isArray(result[0]) ? (result as number[][])[0] : (result as number[]);
  }

  async buscarConhecimento(pergunta: string, conversaId?: string): Promise<string | null> {
    try {
      const embedding = await this.gerarEmbedding(pergunta);
      const embeddingStr = '[' + embedding.join(',') + ']';

      const chunks = await this.prisma.$queryRaw`
        SELECT id, titulo, conteudo,
               1 - (embedding <=> ${embeddingStr}::vector) AS similaridade
        FROM base_conhecimento
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> ${embeddingStr}::vector
        LIMIT 3
      ` as any[];

      const relevantes = chunks.filter((c: any) => Number(c.similaridade) > 0.4);

      if (relevantes.length === 0) {
        await this.prisma.perguntaSemResposta.create({
          data: { pergunta, conversaId: conversaId ?? null },
        });
        this.logger.warn(`Pergunta sem resposta registrada: "${pergunta}"`);
        return null;
      }

      this.logger.log(`RAG vetorial: ${relevantes.length} chunks relevantes para "${pergunta}" (top similaridade: ${Number(relevantes[0].similaridade).toFixed(3)})`);

      const contexto = relevantes.map((c: any) => c.conteudo).join('\n\n');

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

    } catch (err) {
      this.logger.error(`Erro no RAG vetorial: ${err.message}`);
      await this.prisma.perguntaSemResposta.create({
        data: { pergunta, conversaId: conversaId ?? null },
      }).catch(() => {});
      return null;
    }
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
