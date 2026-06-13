import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Groq from 'groq-sdk';

// No início do execute(), adicionar após pegar o contexto:
// 1. Recupera veículo salvo do perfil
const cliente = await this.prisma.cliente.findUnique({
  where: { id: ctx.clienteId },
  select: { veiculoMarca: true, veiculoModelo: true, veiculoAno: true }
});

if (cliente?.veiculoModelo && !ctx.dados.veiculo) {
  ctx.dados.veiculo = cliente.veiculoModelo;
  ctx.dados.ano = cliente.veiculoAno ?? undefined;
  this.logger.log(`Veiculo restaurado: ${cliente.veiculoModelo} ${cliente.veiculoAno}`);
}

// 2. Após confirmar o veículo, salva no perfil:
await this.prisma.cliente.update({
  where: { id: ctx.clienteId },
  data: {
    veiculoModelo: ctx.dados.veiculo,
    veiculoAno: ctx.dados.ano ?? null,
  }
});
