
import { IsNotEmpty, IsNumber, IsString, IsOptional, IsEnum, ValidateIf } from 'class-validator';
import { StockMovementType } from '../../common/enums/stock-movement.enum';

export class UpdateStockMovementDto {
  @IsNotEmpty()
  @IsNumber()
  newQuantityChange: number;

  @IsOptional()
  @IsString()
  newReason?: string;


  @IsOptional()
  @IsString()
  newSourceDocumentId?: string;

  @IsOptional()
  @IsString()
  newSourceDocumentType?: string;

 
  @IsOptional()
  @IsEnum(StockMovementType)
  newMovementType?: StockMovementType;
}