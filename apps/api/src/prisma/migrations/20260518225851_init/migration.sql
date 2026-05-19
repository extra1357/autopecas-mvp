-- CreateEnum
CREATE TYPE "StatusConversa" AS ENUM ('ATIVA', 'AGUARDANDO_HUMANO', 'EM_ATENDIMENTO', 'FINALIZADA', 'EXPIRADA');

-- CreateEnum
CREATE TYPE "EstadoConversa" AS ENUM ('INICIO', 'AGUARDANDO_PECA', 'AGUARDANDO_VEICULO', 'CONSULTANDO_ESTOQUE', 'AGUARDANDO_ENDERECO', 'AGUARDANDO_PAGAMENTO', 'AGUARDANDO_VENDEDOR', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "OrigemMensagem" AS ENUM ('CLIENTE', 'IA', 'HUMANO', 'SISTEMA');

-- CreateEnum
CREATE TYPE "StatusPedido" AS ENUM ('RASCUNHO', 'AGUARDANDO_PAGAMENTO', 'PAGO', 'SEPARANDO', 'ENVIADO', 'ENTREGUE', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoEntrega" AS ENUM ('DELIVERY', 'RETIRADA');

-- CreateEnum
CREATE TYPE "TipoPagamento" AS ENUM ('PIX', 'CARTAO', 'DINHEIRO', 'BOLETO');

-- CreateEnum
CREATE TYPE "StatusAtendimento" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'RESOLVIDO', 'EXPIRADO');

-- CreateEnum
CREATE TYPE "PrioridadeAtendimento" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nome" TEXT,
    "telefone" TEXT NOT NULL,
    "endereco" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversas" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "estadoAtual" "EstadoConversa" NOT NULL DEFAULT 'INICIO',
    "status" "StatusConversa" NOT NULL DEFAULT 'ATIVA',
    "contexto" JSONB NOT NULL DEFAULT '{}',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "origem" "OrigemMensagem" NOT NULL,
    "conteudo" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtos" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "aplicacao" TEXT,
    "marca" TEXT,
    "estoque" INTEGER NOT NULL DEFAULT 0,
    "preco" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "conversaId" TEXT,
    "status" "StatusPedido" NOT NULL DEFAULT 'RASCUNHO',
    "tipoEntrega" "TipoEntrega",
    "pagamento" "TipoPagamento",
    "total" DECIMAL(10,2),
    "endereco" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_pedido" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "precoUnit" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "itens_pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atendimentos" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "vendedorId" TEXT,
    "status" "StatusAtendimento" NOT NULL DEFAULT 'PENDENTE',
    "prioridade" "PrioridadeAtendimento" NOT NULL DEFAULT 'MEDIA',
    "resumo" TEXT,
    "slaMinutos" INTEGER NOT NULL DEFAULT 30,
    "iniciadoEm" TIMESTAMP(3),
    "resolvidoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atendimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs_conversa" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_conversa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clientes_telefone_key" ON "clientes"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "produtos_codigo_key" ON "produtos"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "atendimentos_conversaId_key" ON "atendimentos"("conversaId");

-- AddForeignKey
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "conversas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "conversas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pedido" ADD CONSTRAINT "itens_pedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pedido" ADD CONSTRAINT "itens_pedido_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "conversas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_conversa" ADD CONSTRAINT "logs_conversa_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "conversas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
