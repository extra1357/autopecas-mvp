const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  await prisma.cliente.upsert({
    where: { telefone: "5519900000060" },
    update: { nome: "Teste", aceitaMarketing: true },
    create: { telefone: "5519900000060", nome: "Teste", aceitaMarketing: true }
  });
  const conversas = await prisma.conversa.findMany({
    where: { cliente: { telefone: "5519900000060" } },
    select: { id: true }
  });
  for (const conv of conversas) {
    await prisma.mensagem.deleteMany({ where: { conversaId: conv.id } });
  }
  await prisma.conversa.deleteMany({ where: { cliente: { telefone: "5519900000060" } } });
  console.log("Pronto!");
  await prisma.$disconnect();
}
main().catch(e => console.error(e));
