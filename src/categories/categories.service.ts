import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

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

  async findAll(limit = 10, page = 1): Promise<{items: Category[], total: number, page: number, pageCount: number}> {
    const [items, total] = await this.repo.findAndCount({
      take: limit,
      skip: (page - 1) * limit,
      relations: ['parent', 'children', 'products']
    });
    
    return {
      items,
      total,
      page,
      pageCount: Math.ceil(total / limit)
    };
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