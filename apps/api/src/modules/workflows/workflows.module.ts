import { Module } from '@nestjs/common';
import { WorkflowEngine } from './workflow.engine';
import { BuscarPecaWorkflow } from './buscar-peca.workflow';
import { EntregaWorkflow } from './entrega.workflow';
import { InventoryModule } from '../inventory/inventory.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RagModule } from '../rag/rag.module';

@Module({
  imports: [InventoryModule, PrismaModule, RagModule],
  providers: [WorkflowEngine, BuscarPecaWorkflow, EntregaWorkflow],
  exports: [WorkflowEngine],
})
export class WorkflowsModule {}
