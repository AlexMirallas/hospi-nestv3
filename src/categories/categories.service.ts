import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsOrder, FindOptionsWhere, In } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto,CategoryWithProductCount } from './dto/update-category.dto';
import { SimpleRestParams } from '../common/pipes/parse-simple-rest.pipe'; 
import { CategoryRepository } from './repositories/category.repository';
import { ClsService } from 'nestjs-cls';
import { Role } from '../common/enums/role.enum'; 

@Injectable()
export class CategoriesService {
  constructor(
    private  CategoryRepo: CategoryRepository,
    private readonly cls: ClsService,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {

    const currentUserRoles = this.cls.get('userRoles') as Role[] | undefined;
    const currentUserClientId = this.cls.get('clientId') as string | undefined;

    if (!currentUserRoles || !currentUserClientId) {
      throw new NotFoundException('User context not found. In categories service');
    }

    const isSuperAdmin = currentUserRoles.includes(Role.SuperAdmin);

    if (!isSuperAdmin) {
      createCategoryDto.clientId = currentUserClientId;
    }


    const category = this.CategoryRepo.create(createCategoryDto);
    return this.CategoryRepo.save(category);
  }

  async findAllSimpleRest(
    params: SimpleRestParams,
  ): Promise<{ data: Category[]; totalCount: number }> {
    const { start = 0, end = 9, sort, order = 'ASC', filters = {} } = params;

    const take = end - start + 1;
    const skip = start;
  
    
    const orderOptions: FindOptionsOrder<Category> = {};
    if (sort) {
      if (this.CategoryRepo.metadata.hasColumnWithPropertyPath(sort)) {
        orderOptions[sort] = order.toUpperCase() as 'ASC' | 'DESC';
      } else {
        console.warn(`Ignoring invalid sort field: ${sort}`);
        orderOptions['id'] = 'ASC';
      }
    } else {
      // Default sort
      orderOptions['id'] = 'ASC';
    }

    
    const whereOptions: FindOptionsWhere<Category> | FindOptionsWhere<Category[]> = {};
    
    
    if (filters) {
      for (const key in filters) {
          if (key === 'id') {
              const ids = filters[key];
              if (Array.isArray(ids) && ids.length > 0) {
                  
                  const numericIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
                  if (numericIds.length > 0) {
                     whereOptions[key] = In(numericIds); 
                  } else {
                     whereOptions[key] = In([]);
                  }
              } else if (!isNaN(parseInt(ids, 10))) {
                  whereOptions[key] = parseInt(ids, 10);
              } else {
                  whereOptions[key] = In([]);
              }
          } else if (/* other specific filters like name_like, etc. */ false ) {
               // where[key] = Like(`%${filter[key]}%`);
          }
           else {
              whereOptions[key] = filters[key];
          }
      }
  }
    
    const [data, totalCount] = await this.CategoryRepo.findAndCount({
      where: whereOptions,
      order: orderOptions,
      take: take,
      skip: skip,
      relations: {
        parent: true,
        children: true,
      }, 
    });
  
    return { data, totalCount };
  }

  async findOne(id: number): Promise<Category> {
    const category = await this.CategoryRepo.findOne({ 
      where: { id },
      relations: {
        parent: true,
        children: true, 
        products: true,
      }
    });
    
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    
    return category;
  }

  async update(id: number, updateCategoryDto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);
    
    Object.assign(category, updateCategoryDto);
    
    return this.CategoryRepo.save(category);
  }

  async remove(id: number): Promise<void> {
    const category = await this.findOne(id);
    await this.CategoryRepo.remove(category);
  }


  async getCategoryTree(): Promise<Category[]> {
    // Get all categories
    const categories = await this.CategoryRepo.find({
      relations: {
        parent: true,
        children: true, 
      }
    });
    
    const rootCategories = categories.filter(category => !category.parent);
    
    return rootCategories;
  }


  async findWithProductCount(
    params: SimpleRestParams,
  ): Promise<{ data: CategoryWithProductCount[]; total: number }> {
    const { start = 0, end = 9, sort = 'name', order = 'ASC', filters = {} } = params;

    const take = end - start + 1;
    const skip = start;

    const queryBuilder = this.CategoryRepo.createQueryBuilder('category');
    queryBuilder.leftJoin('category.products', 'product');

   
    queryBuilder.select([
        'category.id',
        'category.name',
        'category.slug',
        'category.description',
        'category.parentId', 
        'category.createdAt',
        'category.updatedAt',
    ]);
    queryBuilder.addSelect('COUNT(product.id)', 'productCount'); 

    
    if (filters.name) {
      queryBuilder.andWhere('category.name ILIKE :name', { name: `%${filters.name}%` });
    }
    if (filters.slug) {
        queryBuilder.andWhere('category.slug = :slug', { slug: filters.slug });
    }
    
    
    queryBuilder.groupBy('category.id');


    // sorting
    const sortField = sort === 'productCount' ? 'productCount' : `category.${sort}`;
    if (this.CategoryRepo.metadata.hasColumnWithPropertyPath(sort) || sort === 'productCount') {
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