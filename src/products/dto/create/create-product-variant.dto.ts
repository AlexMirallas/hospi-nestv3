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
    IsInt,
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
  
    @IsOptional()
    @IsInt()
    @Min(0)
    initialStock?: number;
  
    @IsBoolean()
    @IsOptional()
    isActive?: boolean = true;
  
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AttributeValueRefDto)
    @ArrayNotEmpty( {message: 'At least one attribute value is required.' })
    attributeValues: AttributeValueRefDto[];

    @IsNotEmpty()
    @IsUUID() 
    productId: string;
 
  }