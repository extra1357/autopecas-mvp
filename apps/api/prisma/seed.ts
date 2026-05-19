import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // Ordem correta respeitando foreign keys
  await prisma.atendimento.deleteMany();
  await prisma.mensagem.deleteMany();
  await prisma.logConversa.deleteMany();
  await prisma.itemPedido.deleteMany();
  await prisma.pedido.deleteMany();
  await prisma.conversa.deleteMany();
  await prisma.cliente.deleteMany();

  const clientes = await Promise.all([
    prisma.cliente.create({ data: { telefone: '5511999990001', nome: 'Carlos Silva' } }),
    prisma.cliente.create({ data: { telefone: '5511999990002', nome: 'Ana Souza' } }),
    prisma.cliente.create({ data: { telefone: '5511999990003', nome: 'Roberto Lima' } }),
  ]);

  // Conversa 1 — URGENTE
  const conversa1 = await prisma.conversa.create({
    data: {
      clienteId: clientes[0].id,
      estadoAtual: 'AGUARDANDO_VENDEDOR',
      status: 'AGUARDANDO_HUMANO',
      contexto: { veiculo: 'Gol G5 2012', peca: "Bomba d'água", urgencia: 'alta', intent: 'consulta_preco' },
      mensagens: {
        create: [
          { conteudo: "Oi, preciso de uma bomba d'água pro meu Gol G5 2012", origem: 'CLIENTE' },
          { conteudo: "Bomba d'água Gol G5 2012 disponível por R$ 189,00. Deseja prosseguir?", origem: 'IA' },
          { conteudo: 'Quanto tempo leva? É urgente', origem: 'CLIENTE' },
          { conteudo: 'Vou acionar nossa equipe. Aguarde...', origem: 'IA' },
        ],
      },
    },
  });

  await prisma.atendimento.create({
    data: {
      conversaId: conversa1.id,
      resumo: "Bomba d'água Gol G5 2012 — urgência de entrega. Cliente aguardando confirmação.",
      prioridade: 'URGENTE',
      status: 'PENDENTE',
    },
  });

  // Conversa 2 — MEDIA, negociação
  const conversa2 = await prisma.conversa.create({
    data: {
      clienteId: clientes[1].id,
      estadoAtual: 'AGUARDANDO_VENDEDOR',
      status: 'EM_ATENDIMENTO',
      contexto: { veiculo: 'Civic 2019', peca: 'Pastilha de freio dianteira', intent: 'negociacao', orcamento: 'R$ 150' },
      mensagens: {
        create: [
          { conteudo: 'Boa tarde! Pastilha de freio dianteira Civic 2019', origem: 'CLIENTE' },
          { conteudo: 'Pastilha Fremax para Civic 2019: R$ 210,00 o par.', origem: 'IA' },
          { conteudo: 'Tá caro, tem como fazer por 150?', origem: 'CLIENTE' },
          { conteudo: 'Vou acionar um atendente para negociar.', origem: 'IA' },
          { conteudo: 'Oi Ana, sou o João. Posso fazer R$ 185 à vista!', origem: 'HUMANO' },
        ],
      },
    },
  });

  await prisma.atendimento.create({
    data: {
      conversaId: conversa2.id,
      resumo: 'Pastilha freio Civic 2019 — negociação em andamento com João.',
      prioridade: 'MEDIA',
      status: 'EM_ANDAMENTO',
      vendedorId: 'vendedor-joao',
      iniciadoEm: new Date(),
    },
  });

  // Conversa 3 — ALTA, reclamação
  const conversa3 = await prisma.conversa.create({
    data: {
      clienteId: clientes[2].id,
      estadoAtual: 'AGUARDANDO_VENDEDOR',
      status: 'AGUARDANDO_HUMANO',
      contexto: { veiculo: 'Strada 2018', peca: 'Filtro de óleo', intent: 'reclamacao', pedidoAnterior: 'PED-2024-0892' },
      mensagens: {
        create: [
          { conteudo: 'Comprei um filtro de óleo semana passada e veio errado!', origem: 'CLIENTE' },
          { conteudo: 'Lamento muito Roberto! Verificando pedido PED-2024-0892.', origem: 'IA' },
          { conteudo: 'Já faz 3 dias esperando solução', origem: 'CLIENTE' },
          { conteudo: 'Acionando nossa equipe agora com prioridade.', origem: 'IA' },
        ],
      },
    },
  });

  await prisma.atendimento.create({
    data: {
      conversaId: conversa3.id,
      resumo: 'Filtro óleo Strada 2018 — peça errada entregue. Cliente aguarda há 3 dias.',
      prioridade: 'ALTA',
      status: 'PENDENTE',
    },
  });

  console.log('✅ Seed concluído! 3 clientes, 3 conversas, 3 atendimentos.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
