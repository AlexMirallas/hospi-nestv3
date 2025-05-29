import { Controller, Post, Body, Get, Query, UseGuards, ValidationPipe, UsePipes, BadRequestException, UseInterceptors, Param, Put } from '@nestjs/common';
import { StockService } from './stock.service';
import { GetStockHistoryQueryDto } from './dto/get-stock-history.dto';
import { StockMovement } from './entities/stock-movement.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'; 
import { RolesGuard } from '../common/guards/roles.guard'; 
import { Roles } from '../common/decorators/roles.decorators'; 
import { Role } from '../common/enums/role.enum';
import { ClsService } from 'nestjs-cls';
import { SimpleRestContentRangeInterceptor } from 'src/interceptors/global-interceptors';
import { SimpleRestParams } from '../common/pipes/parse-simple-rest.pipe';
import { ParseSimpleRestParamsPipe } from 'src/common/pipes/parse-simple-rest.pipe';
import { PaginatedResponse } from '../common/pipes/parse-simple-rest.pipe';
import { UpdateStockMovementDto } from './dto/update-stock-movement.dto';

@Controller('stock-movements')
@UseGuards(JwtAuthGuard, RolesGuard) 
@UseInterceptors(SimpleRestContentRangeInterceptor) 
export class StockMovementController {
  constructor(
    private readonly stockService: StockService,
    private readonly cls: ClsService, 
  ) {}

  @Get('/')
  @Roles(Role.Admin, Role.SuperAdmin) 
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  async getStockHistory(
    @Query(ParseSimpleRestParamsPipe) params: SimpleRestParams,
  ): Promise<PaginatedResponse<StockMovement>> { 

    const { filters, sort, order, start, end } = params;

    const serviceQueryDto = new GetStockHistoryQueryDto();

    serviceQueryDto.productId = filters?.productId;
    serviceQueryDto.variantId = filters?.variantId;
    serviceQueryDto.movementType = filters?.movementType; 
    serviceQueryDto.dateFrom = filters?.dateFrom;
    serviceQueryDto.dateTo = filters?.dateTo;

    serviceQueryDto.sortBy = sort;
    serviceQueryDto.sortOrder = order;

    
    if (typeof start === 'number' && typeof end === 'number') {
      const limit = end - start + 1;
      serviceQueryDto.limit = limit > 0 ? limit : 10; 
      serviceQueryDto.page = limit > 0 ? Math.floor(start / limit) + 1 : 1;
    } else {
      serviceQueryDto.page = 1;
      serviceQueryDto.limit = 10;
    }

    
    if (!serviceQueryDto.productId && !serviceQueryDto.variantId) {
      const userRoles = this.cls.get('userRoles') as Role[] | undefined;
      const isSuperAdmin = userRoles?.includes(Role.SuperAdmin);
      if (!isSuperAdmin) {
        throw new BadRequestException('Either productId or variantId must be provided in the filter for stock history.');
      }
    }

    const result = await this.stockService.getStockHistory(serviceQueryDto);

    return {
        data: result.data,
        total: result.total
    };
  }
  @Get(':id')
  @Roles(Role.Admin, Role.SuperAdmin)
  async getStockMovementById(@Param('id') id: string): Promise<StockMovement | null> {
    if (!id) {
      throw new BadRequestException('Stock movement ID is required');
    }
    return this.stockService.getStockMovementById(id);
  
  }

  @Put(':id')
  @Roles(Role.Admin, Role.SuperAdmin)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  async updateStockMovement(
    @Param('id') id: string,
    @Body() updateStockMovementDto: UpdateStockMovementDto, 
  ): Promise<StockMovement> {
    if (!id) {
      throw new BadRequestException('Stock movement ID is required');
    }
    const updateResult = await this.stockService.updateStockMovement(id, updateStockMovementDto);
    return updateResult.correctedMovement;
  }
}
 
