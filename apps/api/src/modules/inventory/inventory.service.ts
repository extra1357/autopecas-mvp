import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  constructor(private prisma: PrismaService) {}

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

    // Filtra por ano se informado
    let resultado = produtos;
    if (ano) {
      const anoNum = parseInt(ano);
      resultado = produtos.filter(p => this.anoCompativel(p.aplicacao || '', anoNum));

      // Se nao encontrou nenhum compativel com o ano, retorna vazio
      // para que o workflow informe que nao ha produto para aquele ano
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

  // Verifica se o ano do cliente esta dentro do range da aplicacao do produto
  // Suporta formatos: "HB20 2018-2023", "Gol 2010/2015", "Corolla 2020"
  private anoCompativel(aplicacao: string, ano: number): boolean {
    // Busca padroes de range: 2018-2023 ou 2018/2023
    const rangeMatch = aplicacao.match(/(\d{4})[-\/](\d{4})/);
    if (rangeMatch) {
      const inicio = parseInt(rangeMatch[1]);
      const fim = parseInt(rangeMatch[2]);
      return ano >= inicio && ano <= fim;
    }

    // Busca ano unico: 2019
    const anoMatch = aplicacao.match(/(\d{4})/);
    if (anoMatch) {
      return parseInt(anoMatch[1]) === ano;
    }

    // Se nao tem ano na aplicacao, retorna true (produto generico)
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
}
