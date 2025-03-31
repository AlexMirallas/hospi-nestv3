import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product } from './entities/product.entity';
import { ProductAttribute } from './entities/product-attribute.entity';
// Import Attribute module if needed for validation/lookup within Product service
// import { AttributesModule } from '../attributes/attributes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductAttribute]),
    // AttributesModule // Make attribute services available if needed
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
