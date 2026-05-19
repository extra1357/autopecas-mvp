import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ResultadoBusca {
  encontrado: boolean;
  produto?: {
    id: string;
    codigo: string;
    nome: string;
    aplicacao: string | null;
    marca: string | null;
    estoque: number;
    preco: number;
  };
  similares?: Array<{
    nome: string;
    aplicacao: string | null;
    preco: number;
    estoque: number;
  }>;
  mensagem: string;
}

export const FORMAS_PAGAMENTO = {
  PIX:     { label: 'PIX',             desconto: 5,  emoji: '💠' },
  CARTAO:  { label: 'Cartão de Crédito', desconto: 0, emoji: '💳' },
  DEBITO:  { label: 'Cartão de Débito', desconto: 2,  emoji: '💳' },
  DINHEIRO:{ label: 'Dinheiro',         desconto: 3,  emoji: '💵' },
};

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async buscarPeca(peca: string, veiculo?: string): Promise<ResultadoBusca> {
    const where: any = {
      OR: [
        { nome: { contains: peca, mode: 'insensitive' } },
        { aplicacao: { contains: peca, mode: 'insensitive' } },
      ],
    };

    if (veiculo) {
      where.OR.push({
        aplicacao: { contains: veiculo, mode: 'insensitive' },
      });
    }

    const produtos = await this.prisma.produto.findMany({ where, take: 5 });

    if (!produtos.length) {
      return {
        encontrado: false,
        mensagem: `Não encontrei *${peca}*${veiculo ? ` para ${veiculo}` : ''} no estoque. Deseja falar com um vendedor?`,
      };
    }

    // Tenta match exato primeiro
    const exato = produtos.find(p =>
      p.nome.toLowerCase().includes(peca.toLowerCase()) &&
      (!veiculo || p.aplicacao?.toLowerCase().includes(veiculo.toLowerCase()))
    ) || produtos[0];

    const similares = produtos
      .filter(p => p.id !== exato.id)
      .map(p => ({
        nome: p.nome,
        aplicacao: p.aplicacao,
        preco: Number(p.preco),
        estoque: p.estoque,
      }));

    if (exato.estoque === 0) {
      return {
        encontrado: false,
        produto: { ...exato, preco: Number(exato.preco) },
        similares,
        mensagem: `❌ *${exato.nome}* está sem estoque no momento.${similares.length ? ' Temos similares disponíveis.' : ' Deseja que um vendedor verifique?'}`,
      };
    }

    return {
      encontrado: true,
      produto: { ...exato, preco: Number(exato.preco) },
      similares,
      mensagem: `✅ *${exato.nome}* disponível!\n💰 Preço: R$ ${Number(exato.preco).toFixed(2)}\n📦 Estoque: ${exato.estoque} unidade(s)`,
    };
  }

  montarMensagemPagamento(preco: number): string {
    const linhas = Object.entries(FORMAS_PAGAMENTO).map(([, v]) => {
      const valor = preco * (1 - v.desconto / 100);
      const desconto = v.desconto > 0 ? ` *(${v.desconto}% off)*` : '';
      return `${v.emoji} ${v.label}: R$ ${valor.toFixed(2)}${desconto}`;
    });

    return `💳 *Formas de pagamento disponíveis:*\n\n${linhas.join('\n')}\n\nQual forma prefere?`;
  }

  parsearPagamento(mensagem: string): string | null {
    const txt = mensagem.toLowerCase();
    if (/pix/.test(txt)) return 'PIX';
    if (/cr[eé]dit/.test(txt)) return 'CARTAO';
    if (/d[eé]bit/.test(txt)) return 'DEBITO';
    if (/dinheiro|espécie|especie|cash/.test(txt)) return 'DINHEIRO';
    return null;
  }

  calcularPrecoFinal(preco: number, formaPagamento: string): number {
    const forma = FORMAS_PAGAMENTO[formaPagamento as keyof typeof FORMAS_PAGAMENTO];
    if (!forma) return preco;
    return preco * (1 - forma.desconto / 100);
  }
}
