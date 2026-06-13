import { PrismaClient } from '@prisma/client';
import { HfInference } from '@huggingface/inference';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

const novosChunks = [
  {
    titulo: 'Parcelamento',
    conteudo: 'Parcelamos em ate 12x no cartao de credito. Para compras acima de R$ 300,00 parcelamos sem juros em ate 3x. Aceitamos todas as bandeiras: Visa, Mastercard, Elo e Hipercard.',
    tags: ['parcelamento', 'parcelas', 'cartao', '12x', 'credito', 'juros'],
    relevancia: 3,
  },
  {
    titulo: 'Area de entrega',
    conteudo: 'Realizamos entregas em Salto, Itu, Indaiatuba, Porto Feliz e regiao. Para outras cidades consultamos o frete sob demanda. Entregamos de segunda a sexta em ate 2 dias uteis.',
    tags: ['entrega', 'delivery', 'area', 'cidade', 'frete', 'regiao', 'salto', 'itu'],
    relevancia: 3,
  },
  {
    titulo: 'Garantia dos produtos',
    conteudo: 'Todos os nossos produtos possuem garantia minima de 90 dias. Pecas originais tem garantia de 1 ano. Em caso de defeito de fabricacao fazemos a troca sem custo adicional.',
    tags: ['garantia', 'defeito', 'original', 'qualidade', 'prazo'],
    relevancia: 3,
  },
  {
    titulo: 'Marcas disponiveis',
    conteudo: 'Trabalhamos com as principais marcas do mercado: Bosch, Monroe, Cofap, Fras-le, Nakata, SKF, NGK, Mann, Mahle, Valeo e outras. Temos pecas originais e linhas economicas.',
    tags: ['marca', 'bosch', 'monroe', 'cofap', 'original', 'qualidade'],
    relevancia: 2,
  },
  {
    titulo: 'Orcamento e consulta',
    conteudo: 'Voce pode solicitar orcamento pelo WhatsApp informando a peca, modelo e ano do veiculo. Respondemos em ate 30 minutos durante o horario comercial.',
    tags: ['orcamento', 'consulta', 'whatsapp', 'tempo', 'resposta'],
    relevancia: 2,
  },
];

async function gerarEmbedding(texto: string): Promise<number[]> {
  const result = await hf.featureExtraction({
    model: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
    inputs: texto,
  }) as number[] | number[][];
  return Array.isArray(result[0]) ? (result as number[][])[0] : (result as number[]);
}

async function main() {
  console.log(`Adicionando ${novosChunks.length} novos chunks...`);
  for (const chunk of novosChunks) {
    const embedding = await gerarEmbedding(chunk.titulo + ' ' + chunk.conteudo);
    const embeddingStr = '[' + embedding.join(',') + ']';

    const criado = await prisma.baseConhecimento.create({
      data: {
        titulo: chunk.titulo,
        conteudo: chunk.conteudo,
        tags: chunk.tags,
        relevancia: chunk.relevancia,
      },
    });

    await prisma.$executeRaw`
      UPDATE base_conhecimento
      SET embedding = ${embeddingStr}::vector
      WHERE id = ${criado.id}
    `;
    console.log(`OK: ${chunk.titulo}`);
  }
  console.log('Base enriquecida com sucesso!');
}
main().catch(console.error).finally(() => prisma.$disconnect());
