import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRaw`ALTER TABLE base_conhecimento ADD COLUMN IF NOT EXISTS embedding vector(1536)`;
  console.log('Coluna embedding adicionada!');
}
main().catch(console.error).finally(() => prisma.$disconnect());
