import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SimpleRestParams } from '../users/users.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private repo: Repository<Product>
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const product = this.repo.create(createProductDto);
    return this.repo.save(product);
  }

  async findAllSimpleRest(
    params: SimpleRestParams,
  ): Promise<{ data: Product[]; totalCount: number }> {
    const { start = 0, end = 9, sort, order = 'ASC', filters = {} } = params;
  
    // Calculate TypeORM pagination options
    const take = end - start + 1;
    const skip = start;
    
    
    // Build a query builder for more complex queries
    const queryBuilder = this.repo.createQueryBuilder('product')
    .leftJoinAndSelect('product.categories', 'category')
    .leftJoinAndSelect('product.attributeCombinations', 'productAttribute') 
    .leftJoinAndSelect('productAttribute.attributeValue', 'attributeValue')
    .leftJoinAndSelect('attributeValue.attribute', 'attribute');
    
      // Add where clauses for filters
    if (filters) {
      for (const key in filters) {
        if (
          Object.prototype.hasOwnProperty.call(filters, key) && 
          filters[key] !== undefined &&
          filters[key] !== null
        ) {
          // Handle special case for categoryId
          if (key === 'categoryId' && filters[key]) {
            queryBuilder.andWhere('category.id = :categoryId', { categoryId: filters[key] });
          }
          // Handle regular fields
          else if (this.repo.metadata.hasColumnWithPropertyPath(key)) {
            queryBuilder.andWhere(`product.${key} = :${key}`, { [key]: filters[key] });
          } else {
            console.warn(`Ignoring invalid filter field: ${key}`);
          }
        }
      }
    }

    // Add sorting
    if (sort && this.repo.metadata.hasColumnWithPropertyPath(sort)) {
      queryBuilder.orderBy(`product.${sort}`, order.toUpperCase() as 'ASC' | 'DESC');
    } else {
      // Default sort
      queryBuilder.orderBy('product.id', 'ASC');
    }
    
    // Add pagination
    queryBuilder.skip(skip).take(take);
    
    // Execute the query
    const [data, totalCount] = await queryBuilder.getManyAndCount();
  
    return { 
      data: data, 
      totalCount: totalCount || 0};
  }



  async findOne(id: string): Promise<Product> {
    const product = await this.repo.findOne({ 
      where: { id },
      relations: [
        'categories', 
        'attributeCombinations',
        'attributeCombinations.attributeValue', 
        'attributeCombinations.attributeValue.attribute'
      ] 
    });
    
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);
    
    Object.assign(product, updateProductDto);
    
    return this.repo.save(product);
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    await this.repo.remove(product);
  }
}