import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SimpleRestParams } from '../users/users.service';
import { Category } from '../categories/entities/category.entity';
import { BadRequestException } from '@nestjs/common/exceptions/bad-request.exception';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private repo: Repository<Product>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>, 
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const product = this.repo.create(createProductDto);
    return this.repo.save(product);
  }

  async findAllSimpleRest(
    params: SimpleRestParams,
  ): Promise<{ data: Product[] ; total: number }> {
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
            queryBuilder.andWhere(`product.${key} LIKE :${key}`, { [key]: `%${filters[key]}%` });
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
    const [data, total] = await queryBuilder.getManyAndCount();

    return {data, total};
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

    const categoryIds = product.categories.map(category => category.id);
    product['categoryIds'] = categoryIds;
    
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
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
    
    Object.assign(product, updateProductDto);

    if (updateProductDto.categoryIds) { // Check if categoryIds are part of the update payload
      if (updateProductDto.categoryIds.length > 0) {
          const categories = await this.categoryRepository.findBy({
              id: In(updateProductDto.categoryIds), // Use TypeORM's In operator
          });
           // Basic check: Ensure all requested category IDs were found
          if (categories.length !== updateProductDto.categoryIds.length) {
              // Handle error - some category IDs were invalid
              throw new BadRequestException('Invalid category ID provided');
          }
          product.categories = categories; // Assign the fetched Category entities
      } else {
           // If an empty array is sent, remove all category associations
          product.categories = [];
      }
  }
    
    return this.repo.save(product);
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    await this.repo.remove(product);
  }
}