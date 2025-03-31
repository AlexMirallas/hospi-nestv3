import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsOrder, FindOptionsWhere } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { SimpleRestParams } from '../users/users.service'; 

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private repo: Repository<Category>
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const category = this.repo.create(createCategoryDto);
    return this.repo.save(category);
  }

  async findAllSimpleRest(
    params: SimpleRestParams,
  ): Promise<{ data: Category[]; totalCount: number }> {
    const { start = 0, end = 9, sort, order = 'ASC', filters = {} } = params;
  
    // Calculate TypeORM pagination options
    const take = end - start + 1;
    const skip = start;
  
    // Build TypeORM sorting options
    const orderOptions: FindOptionsOrder<Category> = {};
    if (sort) {
      if (this.repo.metadata.hasColumnWithPropertyPath(sort)) {
        orderOptions[sort] = order.toUpperCase() as 'ASC' | 'DESC';
      } else {
        console.warn(`Ignoring invalid sort field: ${sort}`);
        // Default sort if invalid
        orderOptions['id'] = 'ASC';
      }
    } else {
      // Default sort
      orderOptions['id'] = 'ASC';
    }

    // Build TypeORM where options for filtering
    const whereOptions: FindOptionsWhere<Category> = {};
    
    // Process filter object
    for (const key in filters) {
      if (
        Object.prototype.hasOwnProperty.call(filters, key) && 
        filters[key] !== undefined &&
        filters[key] !== null
      ) {
        // Check if this is a valid field
        if (this.repo.metadata.hasColumnWithPropertyPath(key)) {
          whereOptions[key] = filters[key];
        } else {
          console.warn(`Ignoring invalid filter field: ${key}`);
        }
      }
    }
    // Fetch data and total count with relations
    const [data, totalCount] = await this.repo.findAndCount({
      where: whereOptions,
      order: orderOptions,
      take: take,
      skip: skip,
      relations: ['parent', 'children'], // Include related categories
    });
  
    return { data, totalCount };
  }

  async findOne(id: number): Promise<Category> {
    const category = await this.repo.findOne({ 
      where: { id },
      relations: ['parent', 'children', 'products']
    });
    
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    
    return category;
  }

  async update(id: number, updateCategoryDto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);
    
    // Update the category
    Object.assign(category, updateCategoryDto);
    
    return this.repo.save(category);
  }

  async remove(id: number): Promise<void> {
    const category = await this.findOne(id);
    await this.repo.remove(category);
  }

  async getCategoryTree(): Promise<Category[]> {
    // Get all categories
    const categories = await this.repo.find({
      relations: ['parent', 'children']
    });
    
    // Filter for root categories (no parent)
    const rootCategories = categories.filter(category => !category.parent);
    
    // Return the tree structure
    return rootCategories;
  }
}