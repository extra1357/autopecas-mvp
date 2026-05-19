import { Module, OnModuleInit } from '@nestjs/common';
import { WorkflowEngine } from './workflow.engine';
import { BuscarPecaWorkflow } from './buscar-peca.workflow';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [WorkflowEngine],
  exports: [WorkflowEngine],
})
export class WorkflowsModule implements OnModuleInit {
  constructor(private engine: WorkflowEngine) {}

  onModuleInit() {
    this.engine.registrar(new BuscarPecaWorkflow());
    console.log('✅ Workflows registrados');
  }
}
