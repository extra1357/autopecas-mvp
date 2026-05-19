import { Injectable } from '@nestjs/common';

export enum EstadoConversa {
  INICIO = 'INICIO',
  AGUARDANDO_PECA = 'AGUARDANDO_PECA',
  AGUARDANDO_VEICULO = 'AGUARDANDO_VEICULO',
  CONSULTANDO_ESTOQUE = 'CONSULTANDO_ESTOQUE',
  AGUARDANDO_ENDERECO = 'AGUARDANDO_ENDERECO',
  AGUARDANDO_PAGAMENTO = 'AGUARDANDO_PAGAMENTO',
  AGUARDANDO_VENDEDOR = 'AGUARDANDO_VENDEDOR',
  FINALIZADO = 'FINALIZADO',
}

export enum Intent {
  BUSCAR_PECA = 'buscar_peca',
  CONSULTAR_PRECO = 'consultar_preco',
  CONSULTAR_ESTOQUE = 'consultar_estoque',
  ENTREGA = 'entrega',
  RETIRADA = 'retirada',
  FALAR_VENDEDOR = 'falar_vendedor',
  STATUS_PEDIDO = 'status_pedido',
  DESCONHECIDO = 'desconhecido',
}

export interface Contexto {
  peca?: string;
  veiculo?: string;
  ano?: string;
  marca?: string;
  pagamento?: string;
  entrega?: string;
  intent?: Intent;
  tentativas?: number;
}

type TransicaoFn = (contexto: Contexto) => EstadoConversa;

const TRANSICOES: Record<EstadoConversa, Partial<Record<Intent, TransicaoFn>>> = {
  [EstadoConversa.INICIO]: {
    [Intent.BUSCAR_PECA]: (ctx) =>
      ctx.peca && ctx.veiculo ? EstadoConversa.CONSULTANDO_ESTOQUE : EstadoConversa.AGUARDANDO_PECA,
    [Intent.FALAR_VENDEDOR]: () => EstadoConversa.AGUARDANDO_VENDEDOR,
    [Intent.STATUS_PEDIDO]: () => EstadoConversa.FINALIZADO,
  },
  [EstadoConversa.AGUARDANDO_PECA]: {
    [Intent.BUSCAR_PECA]: (ctx) =>
      ctx.veiculo ? EstadoConversa.CONSULTANDO_ESTOQUE : EstadoConversa.AGUARDANDO_VEICULO,
  },
  [EstadoConversa.AGUARDANDO_VEICULO]: {
    [Intent.BUSCAR_PECA]: () => EstadoConversa.CONSULTANDO_ESTOQUE,
  },
  [EstadoConversa.CONSULTANDO_ESTOQUE]: {
    [Intent.ENTREGA]: () => EstadoConversa.AGUARDANDO_ENDERECO,
    [Intent.RETIRADA]: () => EstadoConversa.AGUARDANDO_PAGAMENTO,
    [Intent.FALAR_VENDEDOR]: () => EstadoConversa.AGUARDANDO_VENDEDOR,
  },
  [EstadoConversa.AGUARDANDO_ENDERECO]: {
    [Intent.CONSULTAR_PRECO]: () => EstadoConversa.AGUARDANDO_PAGAMENTO,
  },
  [EstadoConversa.AGUARDANDO_PAGAMENTO]: {
    [Intent.CONSULTAR_PRECO]: () => EstadoConversa.FINALIZADO,
  },
  [EstadoConversa.AGUARDANDO_VENDEDOR]: {},
  [EstadoConversa.FINALIZADO]: {},
};

@Injectable()
export class StateMachineService {
  transicionar(
    estadoAtual: EstadoConversa,
    intent: Intent,
    contexto: Contexto,
  ): EstadoConversa {
    const transicoesPossiveis = TRANSICOES[estadoAtual];
    const transicao = transicoesPossiveis?.[intent];

    if (!transicao) {
      console.warn(`[StateMachine] Sem transição: ${estadoAtual} + ${intent}`);
      return estadoAtual;
    }

    const novoEstado = transicao(contexto);
    console.log(`[StateMachine] ${estadoAtual} → ${novoEstado} (intent: ${intent})`);
    return novoEstado;
  }

  precisaHandoff(estadoAtual: EstadoConversa, contexto: Contexto): boolean {
    if (estadoAtual === EstadoConversa.AGUARDANDO_VENDEDOR) return true;
    if ((contexto.tentativas || 0) >= 3) return true;
    return false;
  }
}
