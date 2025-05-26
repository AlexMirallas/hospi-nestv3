import { Controller, Post, Body, Get, Query, UseGuards, ValidationPipe, UsePipes, BadRequestException } from '@nestjs/common';
import { StockService } from './stock.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { GetStockHistoryQueryDto } from './dto/get-stock-history.dto';
import { StockMovement } from './entities/stock-movement.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'; 
import { RolesGuard } from '../common/guards/roles.guard'; 
import { Roles } from '../common/decorators/roles.decorators'; 
import { Role } from '../common/enums/role.enum';
import { ClsService } from 'nestjs-cls';
import { StockMovementType } from 'src/common/enums/stock-movement.enum';

@Controller('adjust-stock')
@UseGuards(JwtAuthGuard, RolesGuard) 
export class AdjustStockController {
  constructor(
    private readonly stockService: StockService,
    private readonly cls: ClsService, 
  ) {}

  @Post('/')
  @Roles(Role.Admin, Role.SuperAdmin) // Define roles that can adjust stock
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async adjustStock(@Body() adjustStockDto: AdjustStockDto): Promise<StockMovement> {
    if (!adjustStockDto.productId && !adjustStockDto.variantId) {
      throw new BadRequestException('Either productId or variantId must be provided.');
    }
    if (adjustStockDto.productId && adjustStockDto.variantId) {
      throw new BadRequestException('Cannot provide both productId and variantId.');
    }
    if (adjustStockDto.quantityChange === 0 && adjustStockDto.movementType !== StockMovementType.INITIAL) { // Allow 0 for initial if needed
        throw new BadRequestException('Quantity change cannot be zero for non-initial movements.');
    }


    // The StockService.recordMovement method already takes RecordMovementData.
    // We can map AdjustStockDto to it.
    // userId and clientId will be picked up by StockService from CLS.
    return this.stockService.recordMovement({
      productId: adjustStockDto.productId,
      variantId: adjustStockDto.variantId,
      quantityChange: adjustStockDto.quantityChange,
      movementType: adjustStockDto.movementType,
      reason: adjustStockDto.reason,
      sourceDocumentId: adjustStockDto.sourceDocumentId,
      sourceDocumentType: adjustStockDto.sourceDocumentType,
      // userId and clientId are handled by the service via CLS
    });
  }
}