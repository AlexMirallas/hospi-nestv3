import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from '../services/products.service';
import { ProductsController } from '../controllers/products.controller';
import { Product } from '../entities/product.entity';
import { CategoriesModule } from 'src/categories/categories.module';
import { ProductVariant } from '../entities/product-variant.entity';
import { ProductAttributeValue } from '../entities/product-attribute-value.entity';
import { AttributesModule } from '../../attributes/attributes.module';
import { VariantsController } from '../controllers/product-variants.controller';
import { SimpleRestContentRangeInterceptor } from 'src/interceptors/global-interceptors';
import { ProductRepository } from '../repositories/product.repository';
import { ProductVariantRepository } from '../repositories/product-variant.repository';
import { AttributeRepository } from 'src/attributes/repositories/attribute.repository';
import { AttributeValueRepository } from 'src/attributes/repositories/attribute-value.repository';
import { CategoryRepository } from 'src/categories/repositories/category.repository';
import { ProductVariantService } from '../services/product-variant.service';
import { ImagesModule } from './images.module';
import { StockModule } from 'src/stock/stock.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductAttributeValue,Product, ProductVariant]),
    AttributesModule, 
    CategoriesModule,
    ImagesModule,
    StockModule, 
  ],
  controllers: [ProductsController,VariantsController],
  providers: [ProductsService,ProductVariantService, SimpleRestContentRangeInterceptor,ProductRepository,ProductVariantRepository, AttributeRepository, AttributeValueRepository, CategoryRepository],
  exports: [ProductsService,ProductVariantService, ProductRepository, ProductVariantRepository, AttributeRepository, AttributeValueRepository, CategoryRepository], 
})
export class ProductsModule {}
