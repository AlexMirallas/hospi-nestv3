import { IsOptional, IsString, IsNotEmpty, IsNumber, IsBoolean, IsArray, IsInt } from 'class-validator';
    

export class UpdateProductDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    sku?: string;
  
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    name?: string;
  
    @IsOptional()
    @IsString()
    description?: string; 
  
    @IsOptional()
    @IsNumber()
    basePrice?: number;
  
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
  
    @IsOptional()
    @IsArray()
    @IsInt({ each: true }) 
    categoryIds?: number[]; 
}