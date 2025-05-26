import { IsOptional, IsString, IsUUID, IsInt, Min, IsEnum, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { StockMovementType } from '../../common/enums/stock-movement.enum';

export class GetStockHistoryQueryDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsOptional()
  @IsEnum(StockMovementType)
  movementType?: StockMovementType;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  sortBy?: string = 'movementDate'; 

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC'; 
}