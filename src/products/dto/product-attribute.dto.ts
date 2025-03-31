import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ProductAttributeDto {
    @IsOptional()
    @IsUUID()
    id?: string; // For updates

    @IsNumber()
    @IsNotEmpty()
    attributeValueId: number; // ID of the AttributeValue (e.g., ID for 'Red' or 'XL')

    @IsOptional()
    @IsString()
    @MaxLength(255)
    variantSku?: string;

    @IsOptional()
    @IsNumber()
    priceAdjustment?: number;

    @IsOptional()
    @IsNumber()
    stockQuantity?: number;
}