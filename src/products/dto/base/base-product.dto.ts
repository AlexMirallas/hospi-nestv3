import { 
    IsString, 
    IsNumber, 
    IsOptional, 
    IsBoolean, 
    IsArray,
    IsUUID,
    MaxLength,
    Min
  } from 'class-validator';
  
  export class ProductDto {
    @IsUUID()
    id: string;
  
    @IsString()
    @MaxLength(255)
    sku: string;
  
    @IsString()
    @MaxLength(255)
    name: string;
  
    @IsString()
    @IsOptional()
    description?: string;
  
    @IsNumber()
    @Min(0)
    basePrice: number;
  
    @IsBoolean()
    isActive: boolean;
  
    @IsOptional()
    @IsArray()
    @IsUUID(undefined, { each: true })
    categoryIds?: string[];
  
    @IsOptional()
    @IsArray()
    variantIds?: string[];
  
    @IsOptional()
    @IsArray()
    categories?: any[];
    
    @IsOptional()
    @IsArray()
    variants?: any[];
  
    @IsString()
    createdAt: string;
  
    @IsString()
    updatedAt: string;
  }