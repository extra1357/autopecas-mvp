import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const itens = [
    {
      titulo: 'Prazo de entrega',
      conteudo: 'Realizamos entregas em ate 2 dias uteis para Salto e regiao. Frete gratis para compras acima de R$ 150,00.',
      tags: ['entrega', 'prazo', 'frete', 'delivery', 'envio', 'demora'],
      relevancia: 5,
    },
    {
      titulo: 'Politica de troca e devolucao',
      conteudo: 'Aceitamos trocas em ate 7 dias corridos com nota fiscal. Pecas com defeito de fabrica tem garantia de 90 dias.',
      tags: ['troca', 'devolucao', 'garantia', 'defeito', 'prazo', 'devolver'],
      relevancia: 5,
    },
    {
      titulo: 'Formas de pagamento',
      conteudo: 'Aceitamos Pix, cartao de credito, cartao de debito e dinheiro. Parcelamento em ate 3x sem juros no cartao.',
      tags: ['pagamento', 'pix', 'cartao', 'credito', 'debito', 'parcelamento', 'pagar'],
      relevancia: 5,
    },
    {
      titulo: 'Horario de funcionamento',
      conteudo: 'Atendemos de segunda a sexta das 8h as 18h e sabados das 8h as 12h. Domingos e feriados fechado.',
      tags: ['horario', 'funcionamento', 'aberto', 'fechado', 'atendimento', 'funciona'],
      relevancia: 4,
    },
    {
      titulo: 'Retirada na loja',
      conteudo: 'A retirada pode ser feita na nossa loja assim que o pedido for confirmado pelo vendedor. O endereco e enviado no momento do pedido.',
      tags: ['retirada', 'loja', 'buscar', 'endereco', 'local', 'retirar', 'busco'],
      relevancia: 4,
    },
    {
      titulo: 'Nota fiscal',
      conteudo: 'Emitimos nota fiscal para todos os pedidos. Informe o CPF ou CNPJ ao confirmar o pedido.',
      tags: ['nota', 'fiscal', 'nf', 'cpf', 'cnpj', 'imposto', 'nfe'],
      relevancia: 3,
    },
    {
      titulo: 'Area de entrega',
      conteudo: 'Fazemos entrega em Salto, Indaiatuba, Itu, Sorocaba e regiao. Para outras cidades consulte disponibilidade com o vendedor.',
      tags: ['entrega', 'area', 'cidade', 'regiao', 'distancia', 'cidades', 'atende'],
      relevancia: 4,
    },
  ];

  for (const item of itens) {
    await prisma.baseConhecimento.upsert({
      where: { id: item.titulo },
      update: item,
      create: { id: item.titulo, ...item },
    });
  }

  console.log('Base de conhecimento populada com sucesso!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
