import { IsString, IsNumber, IsOptional, IsBoolean, IsArray, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class ProductFilterDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  minPrice?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  maxPrice?: number;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  attributeValueIds?: string[];
}