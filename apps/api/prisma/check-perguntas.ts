import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const perguntas = await prisma.perguntaSemResposta.findMany();
  console.log(JSON.stringify(perguntas, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
