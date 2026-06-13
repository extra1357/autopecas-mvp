import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import Groq from "groq-sdk";
import { HfInference } from "@huggingface/inference";

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
      model: "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
      inputs: texto,
    });
    return Array.isArray(result[0]) ? (result as number[][])[0] : (result as number[]);
  }

  // Classifica se a pergunta e sobre peca/estoque ou sobre politica da loja
  private classificarPergunta(pergunta: string): "peca" | "politica" {
    const p = pergunta.toLowerCase();

    const palavrasPeca = [
      "peca", "pecas", "filtro", "pastilha", "amortecedor", "correia", "vela",
      "disco", "tambor", "rolamento", "bomba", "radiador", "alternador", "bateria",
      "embreagem", "tensor", "mangueira", "retifica", "escapamento", "catalisador",
      "suspensao", "cubo", "junta", "valvula", "injetor", "bobina", "sensor",
      "kit", "conjunto", "modulo", "parachoque", "farol", "lanterna", "espelho",
      "tem", "tem no estoque", "voce tem", "voces tem", "tem disponivel",
      "preco", "valor", "quanto custa", "quanto e", "quanto fica",
      "serve", "compativel", "aplica", "encaixa", "e para",
      "onix", "hb20", "polo", "gol", "civic", "corolla", "hilux", "strada",
      "argo", "creta", "kwid", "mobi", "toro", "ranger", "s10", "tucson",
      "hyundai", "chevrolet", "volkswagen", "toyota", "honda", "ford",
      "fiat", "nissan", "renault", "jeep", "mitsubishi",
    ];

    const palavrasPolitica = [
      "entrega", "entreg", "frete", "prazo", "envio", "motoboy",
      "parcela", "parcelar", "parcelamento", "cartao", "pix", "boleto", "pagamento",
      "garantia", "troca", "devolucao", "devolver",
      "horario", "hora", "funcionamento", "abre", "fecha", "aberto", "fechado", "horarios", "atendimento", "expediente", "domingo", "sabado", "segunda", "semana",
      "retirada", "retirar", "buscar", "busca na loja",
      "orcamento", "orcar",
      "marca", "marcas", "trabalha com",
      "whatsapp", "telefone", "contato", "atendimento",
    ];

    const matchPeca = palavrasPeca.some(w => p.includes(w));
    const matchPolitica = palavrasPolitica.some(w => p.includes(w));

    // Se tiver palavras de peca e politica, peca tem prioridade
    if (matchPeca) return "peca";
    if (matchPolitica) return "politica";

    // Padrao: tenta como peca (mais conservador)
    return "peca";
  }

  // Busca peca no catalogo por texto  usa tabela "produto" (mesma do InventoryService)
  private async buscarPecaNosCatalogo(pergunta: string): Promise<string | null> {
    try {
      const palavras = pergunta.toLowerCase().split(/\s+/).filter(w => w.length > 3);

      // Busca direta por nome
      const produtos = await this.prisma.produto.findMany({
        where: {
          estoque: { gt: 0 },
          OR: palavras.map(palavra => ({
            nome: { contains: palavra, mode: "insensitive" },
          })),
        },
        orderBy: { estoque: "desc" },
        take: 5,
      });

      if (produtos.length === 0) return null;
      return this.formatarRespostaPecas(produtos, pergunta);
    } catch (err) {
      this.logger.error(`Erro ao buscar no catalogo: ${err.message}`);
      return null;
    }
  }

  private async formatarRespostaPecas(pecas: any[], pergunta: string): Promise<string | null> {
    const lista = pecas.map(p =>
      `- ${p.nome}: R$ ${Number(p.preco).toFixed(2).replace(".", ",")} (${p.estoque} em estoque)${p.aplicacao ? " | Aplicacao: " + p.aplicacao : ""}`
    ).join("\n");

    const completion = await this.groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: `Voce e atendente de uma loja de autopecas. Um cliente perguntou: "${pergunta}"
Encontramos estas pecas no estoque:
${lista}
Responda de forma direta e amigavel em ate 3 linhas, informando o(s) produto(s), preco(s) e disponibilidade. Se houver mais de uma opcao, mencione as principais.`,
        },
      ],
      temperature: 0.2,
      max_tokens: 200,
    });
    return completion.choices[0]?.message?.content?.trim() ?? null;
  }

  async buscarConhecimento(pergunta: string, conversaId?: string): Promise<string | null> {
    try {
      const tipo = this.classificarPergunta(pergunta);
      this.logger.log(`[RAG] Pergunta classificada como: ${tipo} | "${pergunta}"`);

      // ROTA 1: Pergunta sobre peca  busca APENAS no catalogo
      if (tipo === "peca") {
        const respostaCatalogo = await this.buscarPecaNosCatalogo(pergunta);
        if (respostaCatalogo) {
          this.logger.log(`[RAG] Catalogo respondeu para: "${pergunta}"`);
          return respostaCatalogo;
        }
        // Peca nao encontrada no catalogo -> SEM_RESPOSTA (nao tenta base conhecimento)
        await this.prisma.perguntaSemResposta.create({
          data: { pergunta, conversaId: conversaId ?? null },
        });
        this.logger.warn(`[RAG] Peca nao encontrada no catalogo: "${pergunta}"`);
        return null;
      }

      // ROTA 2: Pergunta sobre politica da loja  busca na BaseConhecimento
      const embedding = await this.gerarEmbedding(pergunta);
      const embeddingStr = "[" + embedding.join(",") + "]";
      const chunks = await this.prisma.$queryRaw`
        SELECT id, titulo, conteudo,
               1 - (embedding <=> ${embeddingStr}::vector) AS similaridade
        FROM base_conhecimento
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> ${embeddingStr}::vector
        LIMIT 3
      ` as any[];

      const relevantes = chunks.filter((c: any) => Number(c.similaridade) > 0.2);
      if (relevantes.length === 0) {
        await this.prisma.perguntaSemResposta.create({
          data: { pergunta, conversaId: conversaId ?? null },
        });
        this.logger.warn(`[RAG] Politica sem resposta na base: "${pergunta}"`);
        return null;
      }

      this.logger.log(`[RAG] BaseConhecimento respondeu para: "${pergunta}"`);
      const contexto = relevantes.map((c: any) => c.conteudo).join("\n\n");
      const completion = await this.groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "user",
            content: `Voce e o atendente virtual de uma loja de autopecas.
Use as informacoes abaixo para responder a pergunta do cliente de forma direta e objetiva.
SE a informacao estiver disponivel abaixo, responda diretamente. NAO diga "vou verificar com um vendedor" se voce tiver a resposta.
NAO invente informacoes sobre pecas, precos ou estoque.
Informacoes da loja:
${contexto}
Pergunta do cliente: "${pergunta}"
Responda de forma direta e amigavel, em ate 2 linhas, usando as informacoes acima.`,
          },
        ],
        temperature: 0.2,
        max_tokens: 200,
      });
      return completion.choices[0]?.message?.content?.trim() ?? null;

    } catch (err) {
      this.logger.error(`Erro no RAG: ${err.message}`);
      await this.prisma.perguntaSemResposta.create({
        data: { pergunta, conversaId: conversaId ?? null },
      }).catch(() => {});
      return null;
    }
  }

  async listarPerguntasSemResposta() {
    return this.prisma.perguntaSemResposta.findMany({
      where: { resolvida: false },
      orderBy: { criadoEm: "desc" },
      take: 50,
    });
  }

  async marcarResolvida(id: string, resposta: string) {
    const perguntaDoc = await this.prisma.perguntaSemResposta.findUnique({ where: { id } });
    if (!perguntaDoc) throw new Error("Pergunta nao encontrada");

    // Valida que a resposta e sobre politica, nao sobre peca especifica
    const tipo = this.classificarPergunta(perguntaDoc.pergunta);
    if (tipo === "peca") {
      throw new Error("Perguntas sobre pecas nao devem ser respondidas manualmente. Cadastre a peca no catalogo.");
    }

    const texto = `Pergunta: ${perguntaDoc.pergunta}\nResposta: ${resposta}`;
    const embedding = await this.gerarEmbedding(texto);
    const embeddingStr = "[" + embedding.join(",") + "]";

    await this.prisma.$executeRaw`
      INSERT INTO base_conhecimento (id, titulo, conteudo, embedding, "criadoEm", "atualizadoEm")
      VALUES (
        gen_random_uuid(),
        ${perguntaDoc.pergunta},
        ${texto},
        ${embeddingStr}::vector,
        NOW(),
        NOW()
      )
    `;

    this.logger.log(`[RAG] Chunk de politica adicionado: "${perguntaDoc.pergunta}"`);

    return this.prisma.perguntaSemResposta.update({
      where: { id },
      data: { resolvida: true },
    });
  }
}
