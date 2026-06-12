import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Groq from 'groq-sdk';

export interface ProdutoEncontrado {
  id: string;
  codigo: string;
  nome: string;
  aplicacao: string;
  marca: string;
  estoque: number;
  preco: number;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);
  private groq: Groq;

  constructor(private prisma: PrismaService) {
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }

  async buscarPeca(peca: string, veiculo?: string, ano?: string): Promise<ProdutoEncontrado[]> {
    this.logger.log(`Buscando: peca=${peca} veiculo=${veiculo} ano=${ano}`);

    const produtos = await this.prisma.produto.findMany({
      where: {
        nome: { contains: peca, mode: 'insensitive' },
        estoque: { gt: 0 },
        ...(veiculo ? {
          aplicacao: { contains: veiculo, mode: 'insensitive' }
        } : {}),
      },
      orderBy: { estoque: 'desc' },
      take: 20,
    });

    let resultado = produtos;
    if (ano) {
      const anoNum = parseInt(ano);
      resultado = produtos.filter(p => this.anoCompativel(p.aplicacao || '', anoNum));
      if (resultado.length === 0) {
        this.logger.warn(`Nenhum produto encontrado para ${peca} ${veiculo} ano ${ano}`);
        return [];
      }
    }

    return resultado.slice(0, 5).map(p => ({
      id: p.id,
      codigo: p.codigo,
      nome: p.nome,
      aplicacao: p.aplicacao || '',
      marca: p.marca || '',
      estoque: p.estoque,
      preco: Number(p.preco),
    }));
  }

  private anoCompativel(aplicacao: string, ano: number): boolean {
    const rangeMatch = aplicacao.match(/(\d{4})[-\/](\d{4})/);
    if (rangeMatch) {
      return ano >= parseInt(rangeMatch[1]) && ano <= parseInt(rangeMatch[2]);
    }
    const anoMatch = aplicacao.match(/(\d{4})/);
    if (anoMatch) return parseInt(anoMatch[1]) === ano;
    return true;
  }

  async buscarSimilares(peca: string): Promise<ProdutoEncontrado[]> {
    const produtos = await this.prisma.produto.findMany({
      where: {
        nome: { contains: peca, mode: 'insensitive' },
        estoque: { gt: 0 },
      },
      orderBy: { estoque: 'desc' },
      take: 3,
    });

    return produtos.map(p => ({
      id: p.id,
      codigo: p.codigo,
      nome: p.nome,
      aplicacao: p.aplicacao || '',
      marca: p.marca || '',
      estoque: p.estoque,
      preco: Number(p.preco),
    }));
  }

  async buscarPecaSemantica(peca: string, veiculo?: string): Promise<ProdutoEncontrado[]> {
    const termos = await this.expandirTermos(peca);
    this.logger.log(`Busca semantica: termos expandidos = ${termos.join(', ')}`);

    const produtos = await this.prisma.produto.findMany({
      where: {
        estoque: { gt: 0 },
        OR: termos.map(termo => ({
          nome: { contains: termo, mode: 'insensitive' },
        })),
        ...(veiculo ? {
          aplicacao: { contains: veiculo, mode: 'insensitive' },
        } : {}),
      },
      orderBy: { estoque: 'desc' },
      take: 5,
    });

    return produtos.map(p => ({
      id: p.id,
      codigo: p.codigo,
      nome: p.nome,
      aplicacao: p.aplicacao || '',
      marca: p.marca || '',
      estoque: p.estoque,
      preco: Number(p.preco),
    }));
  }

  private async expandirTermos(peca: string): Promise<string[]> {
    try {
      const completion = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{
          role: 'user',
          content: `Liste ate 4 termos alternativos para buscar a peca "${peca}" em um catalogo de autopecas brasileiro.
Inclua sinonimos, nomes tecnicos e nomes populares usados no Brasil.
Responda APENAS com JSON valido: {"termos": ["termo1", "termo2", "termo3"]}`,
        }],
        temperature: 0.1,
        max_tokens: 100,
      });

      const texto = completion.choices[0]?.message?.content ?? '';
      const match = texto.match(/\{[\s\S]*\}/);
      if (!match) return [peca];
      const { termos } = JSON.parse(match[0]);
      return [peca, ...(Array.isArray(termos) ? termos : [])];
    } catch {
      return [peca];
    }
  }
}
