import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsOrder, FindOptionsWhere, In } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto,CategoryWithProductCount } from './dto/update-category.dto';
import { SimpleRestParams } from '../common/pipes/parse-simple-rest.pipe'; 

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
    const whereOptions: FindOptionsWhere<Category> | FindOptionsWhere<Category[]> = {};
    
    // Process filter object
    if (filters) {
      for (const key in filters) {
          if (key === 'id') { // <--- SPECIAL HANDLING FOR ID FILTER
              const ids = filters[key];
              if (Array.isArray(ids) && ids.length > 0) {
                  // Ensure they are numbers before passing to IN
                  const numericIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
                  if (numericIds.length > 0) {
                     whereOptions[key] = In(numericIds); // <--- USE 'In' OPERATOR
                  } else {
                     // If filter IDs were invalid, ensure query returns nothing for this filter
                     whereOptions[key] = In([]);
                  }
              } else if (!isNaN(parseInt(ids, 10))) {
                  // Handle case where filter might be passed as single ID: filter={"id": 2}
                  whereOptions[key] = parseInt(ids, 10);
              } else {
                  // Invalid ID format in filter, ensure query returns nothing
                  whereOptions[key] = In([]);
              }
          } else if (/* other specific filters like name_like, etc. */ false ) {
               // Handle other filters (e.g., using Like() operator)
               // where[key] = Like(`%${filter[key]}%`);
          }
           else {
              // Default simple equality for other fields (if applicable)
              whereOptions[key] = filters[key];
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

  async findWithProductCount(
    params: SimpleRestParams,
  ): Promise<{ data: CategoryWithProductCount[]; total: number }> {
    const { start = 0, end = 9, sort = 'name', order = 'ASC', filters = {} } = params;

    const take = end - start + 1;
    const skip = start;

    const queryBuilder = this.repo.createQueryBuilder('category');
    queryBuilder.leftJoin('category.products', 'product');

    // Select category fields explicitly + the count
    queryBuilder.select([
        'category.id',
        'category.name',
        'category.slug',
        'category.description',
        'category.parentId', 
        'category.createdAt',
        'category.updatedAt',
    ]);
    queryBuilder.addSelect('COUNT(product.id)', 'productCount'); // Count products

    // Apply filters (Example: filter by name)
    if (filters.name) {
      queryBuilder.andWhere('category.name ILIKE :name', { name: `%${filters.name}%` });
    }
    if (filters.slug) {
        queryBuilder.andWhere('category.slug = :slug', { slug: filters.slug });
    }
    
    // PostgreSQL requires all selected non-aggregated columns in GROUP BY
    queryBuilder.groupBy('category.id');


    // sorting
    const sortField = sort === 'productCount' ? 'productCount' : `category.${sort}`;
    if (this.repo.metadata.hasColumnWithPropertyPath(sort) || sort === 'productCount') {
        queryBuilder.orderBy(sortField, order.toUpperCase() as 'ASC' | 'DESC');
    } else {
        queryBuilder.orderBy('category.name', 'ASC'); // Default sort
    }

    // Apply pagination
    queryBuilder.offset(skip).limit(take);

    // Execute query to get raw results and total count
    const [rawResults, total] = await queryBuilder.getRawMany();

   
    const data = rawResults.map(raw => ({
        id: raw.category_id,
        name: raw.category_name,
        slug: raw.category_slug,
        description: raw.category_description,
        parentId: raw.category_parentId,
        createdAt: raw.category_createdAt,
        updatedAt: raw.category_updatedAt,
        productCount: parseInt(raw.productCount, 10) || 0,
        children: [], 
        parent: null, 
        products: [], 
    }));


    return { data, total };
  }
}