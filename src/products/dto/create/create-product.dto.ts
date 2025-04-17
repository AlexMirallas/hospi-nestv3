import { IsNotEmpty, IsString, MaxLength, IsOptional, IsNumber, IsBoolean, IsArray, ValidateNested, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateProductVariantDto } from './create-product-variant.dto';

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
    @Min(0)
    basePrice: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean = true;


    @IsOptional()
    @IsArray()
    categoryIds?: string[];


    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateProductVariantDto)
    @IsOptional()
    variants?: CreateProductVariantDto[];

    @IsNotEmpty()
    @IsUUID()
    clientId: string; 
}