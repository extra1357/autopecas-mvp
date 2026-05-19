import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // Produtos de exemplo
  const produtos = [
    { codigo: 'AMO-001', nome: 'Amortecedor Dianteiro', aplicacao: 'HB20 2019-2023', marca: 'Monroe', estoque: 5, preco: 189.90 },
    { codigo: 'AMO-002', nome: 'Amortecedor Traseiro', aplicacao: 'HB20 2019-2023', marca: 'Monroe', estoque: 3, preco: 169.90 },
    { codigo: 'PAR-001', nome: 'Pastilha de Freio Dianteira', aplicacao: 'Onix 2020-2024', marca: 'Fremax', estoque: 12, preco: 89.90 },
    { codigo: 'COR-001', nome: 'Correia Dentada Kit', aplicacao: 'Gol G6 1.0', marca: 'Gates', estoque: 8, preco: 145.00 },
    { codigo: 'FIL-001', nome: 'Filtro de Óleo', aplicacao: 'Universal', marca: 'Mann', estoque: 25, preco: 29.90 },
  ];

  for (const p of produtos) {
    await prisma.produto.upsert({
      where: { codigo: p.codigo },
      update: {},
      create: p,
    });
  }

  console.log(`✅ ${produtos.length} produtos criados`);
  console.log('✅ Seed concluído!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
