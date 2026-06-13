import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`;
  const result = await prisma.$queryRaw`SELECT * FROM pg_extension WHERE extname = 'vector'`;
  console.log('pgvector:', JSON.stringify(result));
}
main().catch(console.error).finally(() => prisma.$disconnect());
