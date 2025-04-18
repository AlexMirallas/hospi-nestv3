import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product } from './entities/product.entity';
import { CategoriesModule } from 'src/categories/categories.module';
import { ProductVariant } from './entities/product-variant.entity';
import { ProductAttributeValue } from './entities/product-attribute-value.entity';
import { AttributesModule } from '../attributes/attributes.module';
import { VariantsController } from './product-variants.controller';
import { SimpleRestContentRangeInterceptor } from 'src/interceptors/global-interceptors';
import { ProductRepository } from './repositories/product.repository';
import { ProductVariantRepository } from './repositories/product-variant.repository';
import { AttributeRepository } from 'src/attributes/repositories/attribute.repository';
import { AttributeValueRepository } from 'src/attributes/repositories/attribute-value.repository';
import { CategoryRepository } from 'src/categories/repositories/category.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductAttributeValue,Product, ProductVariant]),
    AttributesModule, 
    CategoriesModule,
  ],
  controllers: [ProductsController,VariantsController],
  providers: [ProductsService,SimpleRestContentRangeInterceptor,ProductRepository,ProductVariantRepository, AttributeRepository, AttributeValueRepository, CategoryRepository],
  exports: [ProductsService, ProductRepository, ProductVariantRepository, AttributeRepository, AttributeValueRepository, CategoryRepository], 
})
export class ProductsModule {}
