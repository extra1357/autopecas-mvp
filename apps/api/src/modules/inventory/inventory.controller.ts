import { Controller, Get, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('buscar')
  async buscar(
    @Query('peca') peca: string,
    @Query('veiculo') veiculo?: string,
    @Query('ano') ano?: string,
  ) {
    return this.inventoryService.buscarPeca(peca, veiculo, ano);
  }

  @Get('pagamento')
  formasPagamento(@Query('preco') preco: string) {
    const valor = parseFloat(preco || '0');
    const pix = valor;
    const cartao2x = valor / 2;
    return {
      preco: valor,
      mensagem: `PIX: R$ ${pix.toFixed(2)} | Cartao 2x: R$ ${cartao2x.toFixed(2)} | Dinheiro: R$ ${pix.toFixed(2)}`,
    };
  }
}
