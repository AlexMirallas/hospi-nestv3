import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

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

  async findAll(
    limit = 10, 
    page = 1, 
    categoryId?: number
  ): Promise<{items: Product[], total: number, page: number, pageCount: number}> {
    const queryBuilder = this.repo.createQueryBuilder('product')
      .leftJoinAndSelect('product.categories', 'category')
      .leftJoinAndSelect('product.attributes', 'productAttribute')
      .leftJoinAndSelect('productAttribute.attributeValue', 'attributeValue')
      .leftJoinAndSelect('attributeValue.attribute', 'attribute');
    
    if (categoryId) {
      queryBuilder.where('category.id = :categoryId', { categoryId });
    }
    
    queryBuilder.take(limit).skip((page - 1) * limit);
    
    const [items, total] = await queryBuilder.getManyAndCount();
    
    return {
      items,
      total,
      page,
      pageCount: Math.ceil(total / limit)
    };
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.repo.findOne({ 
      where: { id },
      relations: [
        'categories', 
        'attributes', 
        'attributes.attributeValue', 
        'attributes.attributeValue.attribute'
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