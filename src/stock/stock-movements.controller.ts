import { Controller, Post, Body, Get, Query, UseGuards, ValidationPipe, UsePipes, BadRequestException } from '@nestjs/common';
import { StockService } from './stock.service';
import { GetStockHistoryQueryDto } from './dto/get-stock-history.dto';
import { StockMovement } from './entities/stock-movement.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'; 
import { RolesGuard } from '../common/guards/roles.guard'; 
import { Roles } from '../common/decorators/roles.decorators'; 
import { Role } from '../common/enums/role.enum';
import { ClsService } from 'nestjs-cls';

@Controller('stock-movements')
@UseGuards(JwtAuthGuard, RolesGuard) 
export class StockMovementController {
  constructor(
    private readonly stockService: StockService,
    private readonly cls: ClsService, 
  ) {}

  @Get('/')
  @Roles(Role.Admin, Role.SuperAdmin) 
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  async getStockHistory(
    @Query() queryDto: GetStockHistoryQueryDto,
  ): Promise<{ data: StockMovement[]; total: number; page: number; limit: number }> {
     console.log('Received queryDto:', JSON.stringify(queryDto));
     if (!queryDto.productId && !queryDto.variantId) {
        const userRoles = this.cls.get('userRoles') as Role[] | undefined;
        const isSuperAdmin = userRoles?.includes(Role.SuperAdmin);
        // Only throw if not super admin and neither ID is provided.
        // SuperAdmin might be allowed to query all (though this could be a large dataset).
        if (!isSuperAdmin) {
            throw new BadRequestException('Either productId or variantId must be provided for stock history.');
        }
    }
    return this.stockService.getStockHistory(queryDto);
  }
}
 
