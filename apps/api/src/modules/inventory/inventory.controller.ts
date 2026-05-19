import { Controller, Get, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('buscar')
  async buscar(
    @Query('peca') peca: string,
    @Query('veiculo') veiculo?: string,
  ) {
    return this.inventoryService.buscarPeca(peca, veiculo);
  }

  @Get('pagamento')
  formasPagamento(@Query('preco') preco: string) {
    const valor = parseFloat(preco || '0');
    return {
      preco: valor,
      mensagem: this.inventoryService.montarMensagemPagamento(valor),
    };
  }
}
