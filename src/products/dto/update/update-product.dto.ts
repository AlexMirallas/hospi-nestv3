import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from '../create/create-product.dto';

export class UpdateProductDto extends PartialType(CreateProductDto) {}