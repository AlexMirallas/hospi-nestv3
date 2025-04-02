import { ProductVariantDto } from '../base/base-product-variant.dto';
import { ProductAttributeValueResponseDto } from './product-attribute-value-response.dto';

export class ProductVariantResponseDto extends ProductVariantDto {
  declare attributeValues: ProductAttributeValueResponseDto[];
  product?: any; 
}