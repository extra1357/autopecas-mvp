import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Seedando produtos...');

  const produtos = [
    { codigo: 'AMO-HB20-21-D', nome: 'Amortecedor Dianteiro', aplicacao: 'HB20 2018-2023', marca: 'Monroe', estoque: 5, preco: 189.90 },
    { codigo: 'AMO-HB20-21-T', nome: 'Amortecedor Traseiro', aplicacao: 'HB20 2018-2023', marca: 'Monroe', estoque: 3, preco: 159.90 },
    { codigo: 'AMO-GOL-12-D', nome: 'Amortecedor Dianteiro', aplicacao: 'Gol G5 2008-2014', marca: 'Cofap', estoque: 4, preco: 149.90 },
    { codigo: 'AMO-CIV-19-D', nome: 'Amortecedor Dianteiro', aplicacao: 'Civic 2017-2021', marca: 'KYB', estoque: 2, preco: 299.90 },
    { codigo: 'PAS-CIV-19-D', nome: 'Pastilha de Freio Dianteira', aplicacao: 'Civic 2017-2021', marca: 'Fremax', estoque: 8, preco: 189.00 },
    { codigo: 'PAS-HB20-21-D', nome: 'Pastilha de Freio Dianteira', aplicacao: 'HB20 2018-2023', marca: 'Fremax', estoque: 6, preco: 129.00 },
    { codigo: 'PAS-GOL-12-D', nome: 'Pastilha de Freio Dianteira', aplicacao: 'Gol G5 2008-2014', marca: 'Fremax', estoque: 7, preco: 89.00 },
    { codigo: 'FIL-OLE-STR-18', nome: 'Filtro de Oleo', aplicacao: 'Strada 2015-2022', marca: 'Mann', estoque: 15, preco: 45.00 },
    { codigo: 'FIL-OLE-HB20-21', nome: 'Filtro de Oleo', aplicacao: 'HB20 2018-2023', marca: 'Mann', estoque: 12, preco: 39.00 },
    { codigo: 'BOM-GOL-12', nome: 'Bomba de Agua', aplicacao: 'Gol G5 2008-2014', marca: 'Cardone', estoque: 2, preco: 219.00 },
    { codigo: 'EMB-HB20-21', nome: 'Kit Embreagem', aplicacao: 'HB20 2018-2023', marca: 'LUK', estoque: 1, preco: 589.00 },
    { codigo: 'COR-CIV-19', nome: 'Correia Dentada Kit', aplicacao: 'Civic 2017-2021', marca: 'Gates', estoque: 3, preco: 349.00 },
  ];

  for (const p of produtos) {
    await prisma.produto.upsert({
      where: { codigo: p.codigo },
      update: p,
      create: p,
    });
  }

  console.log('12 produtos inseridos com sucesso!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
