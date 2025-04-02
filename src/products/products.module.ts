import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product } from './entities/product.entity';
import { ProductAttribute } from './entities/product-attribute.entity';
import { CategoriesModule } from 'src/categories/categories.module';
import { ProductVariant } from './entities/product-variant.entity';
import { ProductAttributeValue } from './entities/product-attribute-value.entity';
import { AttributesModule } from '../attributes/attributes.module';
import { VariantsController } from './product-variants.controller';
import { SimpleRestContentRangeInterceptor } from 'src/interceptors/global-interceptors';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductAttribute, ProductVariant, ProductAttributeValue]),
    AttributesModule, 
    CategoriesModule,
  ],
  controllers: [ProductsController,VariantsController],
  providers: [ProductsService,SimpleRestContentRangeInterceptor],
  exports: [ProductsService],
})
export class ProductsModule {}
