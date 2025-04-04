import { PartialType } from '@nestjs/mapped-types';
import { CreateCategoryDto } from './create-category.dto';
import { Category } from '../entities/category.entity';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

export interface CategoryWithProductCount extends Category {
    productCount: number;
}