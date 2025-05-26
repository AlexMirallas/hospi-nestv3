import { IsNotEmpty, IsNumber, IsString, IsOptional, IsUUID, ValidateIf, IsEnum } from 'class-validator';
import { StockMovementType } from '../../common/enums/stock-movement.enum';

export class AdjustStockDto {
  @IsOptional()
  @IsUUID()
  @ValidateIf(o => !o.variantId) 
  productId?: string;

  @IsOptional()
  @IsUUID()
  @ValidateIf(o => !o.productId) 
  variantId?: string;

  @IsNotEmpty()
  @IsNumber()
  quantityChange: number; 

  @IsNotEmpty()
  @IsEnum(StockMovementType)
  movementType: StockMovementType;

  @IsOptional()
  @IsString()
  reason?: string;

  
  @IsOptional()
  @IsString()
  sourceDocumentId?: string;

  @IsOptional()
  @IsString()
  sourceDocumentType?: string;
}