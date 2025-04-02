import {
    IsString,
    IsNumber,
    IsOptional,
    IsBoolean,
    IsArray,
    IsUUID,
    IsNotEmpty,
    MaxLength,
    Min
  } from 'class-validator';
  
  export class ProductVariantDto {
    @IsUUID()
    id: string;
  
    @IsString()
    @MaxLength(255)
    sku: string;
  
    @IsUUID()
    productId: string;
  
    @IsNumber()
    @IsOptional()
    @Min(0)
    priceAdjustment?: number;
  
    @IsNumber()
    @Min(0)
    stockQuantity: number;
  
    @IsBoolean()
    isActive: boolean;
  
    @IsArray()
    attributeValues: any[];
  
    @IsString()
    createdAt: string;
  
    @IsString()
    updatedAt: string;
  }