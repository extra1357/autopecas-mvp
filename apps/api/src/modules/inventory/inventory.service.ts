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

    const condicoes: any[] = [];

    if (peca) {
      condicoes.push({ nome: { contains: peca, mode: 'insensitive' } });
      condicoes.push({ aplicacao: { contains: peca, mode: 'insensitive' } });
    }

    const produtos = await this.prisma.produto.findMany({
      where: {
        OR: condicoes,
        ...(veiculo ? {
          aplicacao: { contains: veiculo, mode: 'insensitive' }
        } : {}),
        estoque: { gt: 0 },
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
