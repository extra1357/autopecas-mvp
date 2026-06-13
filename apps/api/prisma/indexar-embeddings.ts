import { PrismaClient } from '@prisma/client';
import { HfInference } from '@huggingface/inference';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

async function main() {
  const chunks = await prisma.baseConhecimento.findMany();
  console.log(`Indexando ${chunks.length} chunks...`);
  for (const chunk of chunks) {
    const result = await hf.featureExtraction({
      model: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
      inputs: chunk.titulo + ' ' + chunk.conteudo,
    }) as number[] | number[][];
    const vetor: number[] = Array.isArray(result[0]) ? (result as number[][])[0] : (result as number[]);
    const embeddingStr = '[' + vetor.join(',') + ']';
    await prisma.$executeRaw`
      UPDATE base_conhecimento
      SET embedding = ${embeddingStr}::vector
      WHERE id = ${chunk.id}
    `;
    console.log(`OK: ${chunk.titulo}`);
  }
  console.log('Indexacao concluida!');
}
main().catch(console.error).finally(() => prisma.$disconnect());
