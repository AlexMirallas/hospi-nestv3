import { IsNotEmpty, IsString, MaxLength, IsOptional, IsNumber, IsBoolean, IsArray, ValidateNested, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ProductAttributeDto } from './product-attribute.dto';

export class CreateProductDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    sku: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsNumber()
    basePrice: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean = true;

    //handle category IDs
    @IsOptional()
    @IsArray()
    categoryIds?: string[];

    // Handle nested attribute combinations
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ProductAttributeDto)
    attributeCombinations?: ProductAttributeDto[];
}