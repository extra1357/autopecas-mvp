import { PrismaClient } from "@prisma/client";
import { HfInference } from "@huggingface/inference";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const prisma = new PrismaClient();
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

async function gerarEmbedding(texto: string): Promise<number[]> {
  const result = await hf.featureExtraction({
    model: "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    inputs: texto,
  });
  return Array.isArray(result[0]) ? (result as number[][])[0] : (result as number[]);
}

const conhecimentos = [
  {
    titulo: "Entrega e frete",
    embedding_texto: "voces fazem entrega frete motoboy envio prazo",
    conteudo: "Sim, fazemos entrega via motoboy para a cidade e regiao. O prazo e de 1 a 2 horas apos confirmacao do pagamento. Para cidades vizinhas, o prazo pode ser de 1 dia util. O frete e calculado conforme a distancia.",
    tags: ["entrega","frete","motoboy","envio","prazo"],
  },
  {
    titulo: "Formas de pagamento e parcelamento",
    embedding_texto: "voces parcelam cartao pix boleto pagamento parcelamento",
    conteudo: "Sim! Aceitamos cartao de credito em ate 6x sem juros, debito, PIX e boleto bancario. No PIX e boleto, o pagamento deve ser confirmado antes do envio.",
    tags: ["parcela","parcelamento","cartao","pix","boleto","pagamento"],
  },
  {
    titulo: "Horario de funcionamento",
    embedding_texto: "horario funcionamento abre fecha quando aberto fechado sabado domingo",
    conteudo: "Funcionamos de segunda a sexta das 8h as 18h e sabado das 8h as 13h. Aos domingos e feriados estamos fechados.",
    tags: ["horario","funcionamento","abre","fecha","sabado","domingo"],
  },
  {
    titulo: "Garantia e troca",
    embedding_texto: "garantia troca devolucao prazo garantia pecas",
    conteudo: "Todas as nossas pecas possuem garantia minima de 3 meses. Pecas de marcas como Monroe, Gates e Mann possuem garantia de 6 meses a 1 ano conforme o fabricante.",
    tags: ["garantia","troca","devolucao"],
  },
  {
    titulo: "Retirada na loja",
    embedding_texto: "posso retirar buscar pegar na loja retirada",
    conteudo: "Sim! Pode retirar diretamente na loja no horario de atendimento. Basta confirmar a disponibilidade pelo WhatsApp antes de vir.",
    tags: ["retirada","retirar","buscar"],
  },
  {
    titulo: "Marcas trabalhadas",
    embedding_texto: "quais marcas trabalham vendem monroe bosch ngk",
    conteudo: "Trabalhamos com as principais marcas do mercado: Monroe, Fremax, Gates, Mann, Cofap, Bosch, NGK, Mahle, Wega, entre outras.",
    tags: ["marca","marcas"],
  },
  {
    titulo: "Contato e atendimento",
    embedding_texto: "contato telefone whatsapp falar atendimento vendedor",
    conteudo: "Voce ja esta sendo atendido pelo nosso WhatsApp! Para falar com um vendedor humano, e so pedir. Tambem temos atendimento pelo telefone da loja no horario comercial.",
    tags: ["contato","whatsapp","telefone","atendimento"],
  },
  {
    titulo: "Orcamento",
    embedding_texto: "orcamento orcar preco valor quanto custa",
    conteudo: "Claro! Me informe a peca que precisa e o modelo do seu veiculo que verifico o preco e disponibilidade para voce.",
    tags: ["orcamento","orcar"],
  },
];

async function main() {
  console.log("Limpando chunks antigos do seed...");
  await prisma.$executeRaw`
    DELETE FROM base_conhecimento
    WHERE titulo IN (
      'Entrega e frete','Formas de pagamento e parcelamento',
      'Horario de funcionamento','Garantia e troca','Retirada na loja',
      'Marcas trabalhadas','Contato e atendimento','Orcamento'
    )
  `;
  console.log("Deletados!");

  for (const item of conhecimentos) {
    const embedding = await gerarEmbedding(item.embedding_texto);
    const embeddingStr = "[" + embedding.join(",") + "]";
    const tagsArr = "{" + item.tags.join(",") + "}";

    await prisma.$executeRaw`
      INSERT INTO base_conhecimento (id, titulo, conteudo, tags, relevancia, embedding, "criadoEm")
      VALUES (
        gen_random_uuid(),
        ${item.titulo},
        ${item.conteudo},
        ${tagsArr}::text[],
        1,
        ${embeddingStr}::vector,
        NOW()
      )
    `;
    console.log("OK: " + item.titulo);
  }
  console.log("Concluido!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
