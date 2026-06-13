import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const result = await prisma.$queryRaw`SELECT extname FROM pg_extension WHERE extname = 'vector'` as any[];
  console.log('pgvector disponivel:', result.length > 0 ? 'SIM' : 'NAO');
}
main().catch(console.error).finally(() => prisma.$disconnect());
