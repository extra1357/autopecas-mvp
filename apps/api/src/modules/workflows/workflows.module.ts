import { Module } from '@nestjs/common';
import { WorkflowEngine } from './workflow.engine';
import { BuscarPecaWorkflow } from './buscar-peca.workflow';
import { EntregaWorkflow } from './entrega.workflow';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [InventoryModule],
  providers: [WorkflowEngine, BuscarPecaWorkflow, EntregaWorkflow],
  exports: [WorkflowEngine],
})
export class WorkflowsModule {}