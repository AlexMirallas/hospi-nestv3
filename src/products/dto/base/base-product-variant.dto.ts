import {
    IsString,
    IsNumber,
    IsOptional,
    IsBoolean,
    IsArray,
    IsUUID,
    MaxLength,
    Min,
    IsInt,
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
  
    @IsOptional()
    @IsInt()
    @Min(0)
    initialStock?: number;
    

  
    @IsBoolean()
    isActive: boolean;
  
    @IsArray()
    attributeValues: any[];
  
    @IsString()
    createdAt: string;
  
    @IsString()
    updatedAt: string;
  }