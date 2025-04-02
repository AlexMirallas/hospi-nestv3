import { ProductDto } from '../base/base-product.dto';
import { ProductVariantResponseDto } from './product-variant-response.dto';

export class ProductResponseDto extends ProductDto {
  declare variants: ProductVariantResponseDto[];
  
  // Calculate final price including base price
  get finalPrice(): number {
    if (!this.variants || this.variants.length === 0) {
      return this.basePrice;
    }
    
    // Find lowest variant price
    const lowestVariantPrice = Math.min(
      ...this.variants.map(variant => this.basePrice + (variant.priceAdjustment || 0))
    );
    
    return lowestVariantPrice;
  }
}