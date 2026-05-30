import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.mensagem.deleteMany({});
  await prisma.conversa.deleteMany({});
  await prisma.cliente.deleteMany({});
  console.log('Banco limpo com sucesso!');
}

main().catch(console.error).finally(() => prisma.$disconnect());