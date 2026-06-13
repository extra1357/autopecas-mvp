import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const pecas = [
  // CHEVROLET ONIX
  { codigo: 'FRE-ONX-001', nome: 'Pastilha de Freio Dianteira Onix 2013-2023', aplicacao: 'Chevrolet Onix 2013-2023 / Onix Plus 2019-2023', marca: 'Fras-le', estoque: 25, preco: 89.90 },
  { codigo: 'FIL-ONX-002', nome: 'Filtro de Oleo Onix 1.0 Flex', aplicacao: 'Chevrolet Onix 1.0 2013-2023 / Cobalt 1.0', marca: 'Mann', estoque: 40, preco: 42.00 },
  { codigo: 'AMS-ONX-003', nome: 'Amortecedor Traseiro Onix 2013-2019', aplicacao: 'Chevrolet Onix 2013-2019 / Sonic', marca: 'Monroe', estoque: 12, preco: 185.00 },
  { codigo: 'COR-ONX-004', nome: 'Kit Correia Dentada Onix 1.4 com Tensor', aplicacao: 'Chevrolet Onix 1.4 2013-2019 / Prisma 1.4', marca: 'Gates', estoque: 8, preco: 210.00 },
  { codigo: 'VEL-ONX-005', nome: 'Vela de Ignicao Onix 1.0 Turbo (jogo 3un)', aplicacao: 'Chevrolet Onix 1.0 Turbo 2019-2023 / Onix Plus Turbo', marca: 'NGK', estoque: 30, preco: 95.00 },

  // HYUNDAI HB20
  { codigo: 'FRE-HB2-001', nome: 'Pastilha de Freio Dianteira HB20 2012-2022', aplicacao: 'Hyundai HB20 2012-2022 / HB20S 2012-2022', marca: 'Fras-le', estoque: 20, preco: 79.90 },
  { codigo: 'FIL-HB2-002', nome: 'Filtro de Ar HB20 1.0 Flex', aplicacao: 'Hyundai HB20 1.0 2012-2022 / HB20S 1.0', marca: 'Mann', estoque: 35, preco: 38.00 },
  { codigo: 'AMS-HB2-003', nome: 'Amortecedor Dianteiro HB20 2012-2019', aplicacao: 'Hyundai HB20 2012-2019 / HB20S 2012-2019', marca: 'Monroe', estoque: 10, preco: 220.00 },
  { codigo: 'FRE-HB2-004', nome: 'Disco de Freio Dianteiro HB20 (par)', aplicacao: 'Hyundai HB20 2012-2022 / HB20X 2012-2022', marca: 'Cofap', estoque: 15, preco: 245.00 },
  { codigo: 'BAT-HB2-005', nome: 'Bateria 60Ah HB20', aplicacao: 'Hyundai HB20 todos / HB20S todos / Creta', marca: 'Moura', estoque: 7, preco: 480.00 },

  // VOLKSWAGEN POLO / GOL
  { codigo: 'FRE-POL-001', nome: 'Pastilha de Freio Polo 2018+ plataforma MQB', aplicacao: 'VW Polo 2018-2024 / Virtus 2018-2024 / Nivus', marca: 'Bosch', estoque: 18, preco: 120.00 },
  { codigo: 'FIL-GOL-002', nome: 'Filtro de Combustivel Gol G5/G6', aplicacao: 'VW Gol G5 2009-2014 / Gol G6 2012-2016 / Voyage G6', marca: 'Mann', estoque: 22, preco: 65.00 },
  { codigo: 'EMB-GOL-003', nome: 'Kit Embreagem Gol 1.6 8v (disco+plato+rolamento)', aplicacao: 'VW Gol 1.6 2009-2016 / Voyage 1.6 / Fox 1.6', marca: 'LUK', estoque: 5, preco: 520.00 },
  { codigo: 'AMS-POL-004', nome: 'Amortecedor Dianteiro Polo 2018+', aplicacao: 'VW Polo 2018-2024 / Virtus 2018-2024', marca: 'Sachs', estoque: 9, preco: 310.00 },
  { codigo: 'VEL-GOL-005', nome: 'Vela de Ignicao Gol/Polo 1.0 (jogo 4un)', aplicacao: 'VW Gol 1.0 2009-2016 / Polo 1.0 2018-2022 / Fox 1.0', marca: 'NGK', estoque: 28, preco: 72.00 },

  // FIAT STRADA / ARGO / UNO
  { codigo: 'FRE-STR-001', nome: 'Pastilha de Freio Strada 2021+ nova geracao', aplicacao: 'Fiat Strada 2021-2024 / Fastback', marca: 'Fras-le', estoque: 20, preco: 98.00 },
  { codigo: 'FIL-ARG-002', nome: 'Filtro de Oleo Fiat Argo/Cronos 1.3 Drive', aplicacao: 'Fiat Argo 1.3 2017-2024 / Cronos 1.3 2018-2024 / Mobi 1.0', marca: 'Mahle', estoque: 32, preco: 44.00 },
  { codigo: 'AMS-UNO-003', nome: 'Amortecedor Traseiro Uno 2011+ (par)', aplicacao: 'Fiat Uno 2011-2023 / Fiorino', marca: 'Monroe', estoque: 11, preco: 210.00 },
  { codigo: 'COR-ARG-004', nome: 'Correia Alternador Fiat Argo/Strada 1.3', aplicacao: 'Fiat Argo 1.3 2017-2024 / Strada 1.3 2021-2024 / Cronos 1.3', marca: 'Gates', estoque: 18, preco: 55.00 },
  { codigo: 'BAT-UNO-005', nome: 'Bateria 50Ah Fiat Mobi/Uno 1.0', aplicacao: 'Fiat Mobi 2016-2024 / Uno 1.0 2011-2023', marca: 'Heliar', estoque: 8, preco: 390.00 },

  // TOYOTA COROLLA / HILUX
  { codigo: 'FRE-COR-001', nome: 'Pastilha de Freio Corolla 2020+ 12a geracao', aplicacao: 'Toyota Corolla 2020-2024 / Corolla GR Sport', marca: 'Bosch', estoque: 12, preco: 185.00 },
  { codigo: 'FIL-HIL-002', nome: 'Filtro de Oleo Hilux 2.8 Diesel 2016-2024', aplicacao: 'Toyota Hilux 2.8 D 2016-2024 / SW4 2.8 D', marca: 'Mahle', estoque: 20, preco: 68.00 },
  { codigo: 'SUS-HIL-003', nome: 'Kit Buchas Bandeja Dianteira Hilux 4x4', aplicacao: 'Toyota Hilux 2005-2015 / SW4 2005-2015', marca: 'Nakata', estoque: 9, preco: 145.00 },
  { codigo: 'VEL-COR-004', nome: 'Vela Ignicao Iridium Corolla 2.0 (jogo 4un)', aplicacao: 'Toyota Corolla 2.0 2015-2024 / RAV4 2.0', marca: 'NGK', estoque: 10, preco: 320.00 },
  { codigo: 'FRE-HIL-005', nome: 'Disco de Freio Traseiro Hilux 2016+ (par)', aplicacao: 'Toyota Hilux 2016-2024 / SW4 2016-2024', marca: 'Cofap', estoque: 7, preco: 380.00 },

  // HONDA CIVIC / HR-V
  { codigo: 'FRE-CIV-001', nome: 'Pastilha de Freio Civic 2017-2023 10a ger.', aplicacao: 'Honda Civic 2017-2023 / HR-V 2015-2021', marca: 'Bosch', estoque: 13, preco: 165.00 },
  { codigo: 'FIL-CIV-002', nome: 'Filtro de Ar Honda Civic 1.5 Turbo', aplicacao: 'Honda Civic 1.5 Turbo 2017-2023', marca: 'Mann', estoque: 22, preco: 52.00 },

  // HYUNDAI CRETA
  { codigo: 'FRE-CRE-001', nome: 'Pastilha de Freio Creta 1.6/2.0 2017+', aplicacao: 'Hyundai Creta 1.6 2017-2024 / Creta 2.0 2017-2024', marca: 'Fras-le', estoque: 16, preco: 132.00 },
  { codigo: 'AMS-CRE-002', nome: 'Amortecedor Dianteiro Creta 2017-2024', aplicacao: 'Hyundai Creta 2017-2024', marca: 'Monroe', estoque: 8, preco: 295.00 },

  // UNIVERSAL
  { codigo: 'FIL-CAB-UNI', nome: 'Filtro de Cabine Ar Condicionado Compactos', aplicacao: 'Onix 2017-2024 / HB20 2017-2024 / Polo 2018-2024 / Argo 2017-2024', marca: 'Mahle', estoque: 50, preco: 35.00 },
  { codigo: 'FRE-LON-UNI', nome: 'Fluido de Freio DOT4 500ml', aplicacao: 'Universal - todos os veiculos', marca: 'Bosch', estoque: 60, preco: 28.00 },
];

async function main() {
  console.log(`\nIniciando seed de ${pecas.length} pecas...\n`);
  let criadas = 0;
  let puladas = 0;

  for (const peca of pecas) {
    const existe = await prisma.produto.findUnique({ where: { codigo: peca.codigo } });
    if (existe) {
      console.log(`[SKIP] ${peca.codigo} - ${peca.nome}`);
      puladas++;
      continue;
    }
    await prisma.produto.create({ data: peca });
    console.log(`[OK]   ${peca.codigo} - ${peca.nome} - R$ ${peca.preco}`);
    criadas++;
  }

  console.log(`\nConcluido! ${criadas} criadas, ${puladas} ja existiam.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
