import { PartialType } from '@nestjs/mapped-types';
import { CreateProductVariantDto } from '../create/create-product-variant.dto';
  
  export class UpdateProductVariantDto extends PartialType(CreateProductVariantDto){}