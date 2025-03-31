import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TypeOrmCrudService } from '@nestjsx/crud-typeorm';
import { Product } from './entities/product.entity';
import { ProductAttribute } from './entities/product-attribute.entity';
// Import DTOs if needed for complex logic
// import { CreateProductDto } from './dto/create-product.dto';
// import { CrudRequest } from '@nestjsx/crud';

@Injectable()
export class ProductsService extends TypeOrmCrudService<Product> {
  constructor(
      @InjectRepository(Product) repo: Repository<Product>,
      // Inject ProductAttribute repository if complex variant handling is needed in service
      @InjectRepository(ProductAttribute) private readonly productAttributeRepo: Repository<ProductAttribute>,
    ) {
    super(repo);
  }

  // Override create/update methods IF the default @nestjsx/crud handling
  // for relations isn't sufficient for your variant logic.
  // The default often works well if DTOs match entity structure.
  // Example (if needed):
  // async createOne(req: CrudRequest, dto: CreateProductDto): Promise<Product> {
  //    // Custom logic to handle dto.attributeCombinations before saving Product
  //    // e.g., map DTOs to entities, maybe generate variant SKUs etc.
  //    const product = this.repo.create(dto); // Create entity instance
       // Manual handling of relations if cascade doesn't work as expected
       // if (dto.attributeCombinations && dto.attributeCombinations.length > 0) {
       //    product.attributeCombinations = dto.attributeCombinations.map(comboDto => {
       //        const pa = this.productAttributeRepo.create(comboDto);
       //        // pa.product = product; // Link back manually if needed
       //        return pa;
       //    });
       // }
  //    const savedProduct = await super.createOne(req, product as any); // Need to ensure type compatibility
       // You might need to save combinations separately if cascade isn't used/working right
  //    return savedProduct;
  // }

  // async updateOne(req: CrudRequest, dto: UpdateProductDto): Promise<Product> {
  //    // Complex logic to handle updates to attributeCombinations
  //    // (adding new ones, updating existing, removing old ones)
  //    return super.updateOne(req, dto);
  // }

}
