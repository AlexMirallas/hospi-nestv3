import {
    IsString,
    IsNumber,
    IsOptional,
    IsBoolean,
    IsArray,
    ValidateNested,
    IsNotEmpty,
    MaxLength,
    Min,
    ArrayNotEmpty,
    IsUUID,
  } from 'class-validator';
  import { Type } from 'class-transformer';
  import { AttributeValueRefDto } from '../base/attribute-value-reference.dto';
  
  export class CreateProductVariantDto {
    @IsString()
    @MaxLength(255)
    @IsNotEmpty()
    sku: string;
  
    @IsNumber()
    @IsOptional()
    @Min(0)
    priceAdjustment?: number = 0;
  
    @IsNumber()
    @IsOptional()
    @Min(0)
    stockQuantity?: number = 0;
  
    @IsBoolean()
    @IsOptional()
    isActive?: boolean = true;
  
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AttributeValueRefDto)
    @ArrayNotEmpty()
    attributeValues: AttributeValueRefDto[];

    @IsNotEmpty()
    @IsUUID() // Validate that a product ID is provided and is a UUID
    productId: string;
  }