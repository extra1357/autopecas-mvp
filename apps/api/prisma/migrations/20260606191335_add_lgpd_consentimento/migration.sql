-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EstadoConversa" ADD VALUE 'AGUARDANDO_TIPO_ATENDIMENTO';
ALTER TYPE "EstadoConversa" ADD VALUE 'AGUARDANDO_HUMANO';
ALTER TYPE "EstadoConversa" ADD VALUE 'FINALIZADA';
ALTER TYPE "EstadoConversa" ADD VALUE 'AGUARDANDO_CONFIRMACAO_KIT';
ALTER TYPE "EstadoConversa" ADD VALUE 'AGUARDANDO_CONFIRMACAO_ITEM';
ALTER TYPE "EstadoConversa" ADD VALUE 'AGUARDANDO_MAIS_ITENS';

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "aceitaMarketing" BOOLEAN,
ADD COLUMN     "consentimentoEm" TIMESTAMP(3),
ADD COLUMN     "consentimentoOrigem" TEXT;
