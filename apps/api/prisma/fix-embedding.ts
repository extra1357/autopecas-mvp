import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRaw`ALTER TABLE base_conhecimento DROP COLUMN IF EXISTS embedding`;
  await prisma.$executeRaw`ALTER TABLE base_conhecimento ADD COLUMN embedding vector(384)`;
  console.log('Coluna embedding recriada com 384 dimensoes!');
}
main().catch(console.error).finally(() => prisma.$disconnect());
