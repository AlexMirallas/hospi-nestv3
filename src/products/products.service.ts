import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, ForbiddenException,ConflictException } from '@nestjs/common';
import { InjectRepository, } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { ProductAttributeValue } from './entities/product-attribute-value.entity';
import { CreateProductDto } from './dto/create/create-product.dto';
import { UpdateProductDto } from './dto/update/update-product.dto';
import { SimpleRestParams } from '../common/pipes/parse-simple-rest.pipe';
import { Category } from '../categories/entities/category.entity';
import { AttributeValue } from '../attributes/entities/attribute-value.entity';
import { Attribute } from '../attributes/entities/attribute.entity';
import { CreateProductVariantDto } from './dto/create/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update/update-product-variant.dto';
import { ProductRepository } from './repositories/product.repository';
import { ProductVariantRepository } from './repositories/product-variant.repository';
import { AttributeValueRepository } from '../attributes/repositories/attribute-value.repository';
import { AttributeRepository } from '../attributes/repositories/attribute.repository';
import { CategoryRepository } from '../categories/repositories/category.repository';
import { ClsService } from 'nestjs-cls';
import { Role } from '../common/enums/role.enum';


@Injectable()
export class ProductsService {
  constructor(
    private productRepo: ProductRepository,
    private variantRepo: ProductVariantRepository,
    @InjectRepository(ProductAttributeValue)
    private attributeValueRepo: Repository<ProductAttributeValue>,
    private attributeValueBaseRepo: AttributeValueRepository,
    private attributeRepo: AttributeRepository,
    private categoryRepository:  CategoryRepository,
    private dataSource: DataSource,
    private readonly cls: ClsService,
  ) {}

  /**
   * Create a product with variants
   */
  async create(createProductDto: CreateProductDto): Promise<Product> {
    
    const currentUserRoles = this.cls.get('userRoles') as Role[] | undefined;
    const currentUserClientId = this.cls.get('clientId') as string | undefined;

    if (!currentUserRoles || !currentUserClientId) {
        throw new InternalServerErrorException('User context not found.');
    }

    const isSuperAdmin = currentUserRoles.includes(Role.SuperAdmin);
    let finalClientId = createProductDto.clientId;

    if (isSuperAdmin) {
      console.log(`SuperAdmin creating product for client ${finalClientId}`);
  } else if (currentUserRoles.includes(Role.Admin)) {
      finalClientId = currentUserClientId;
      console.log(`Admin creating product. Overriding clientId to Admin's client: ${finalClientId}`);
  } else {
      throw new ForbiddenException('You do not have permission to create products.');
  }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    console.log('>>> Received createProductDto:', createProductDto);

    try {
      const product = this.productRepo.create({
        sku: createProductDto.sku,
        name: createProductDto.name,
        description: createProductDto.description,
        basePrice: createProductDto.basePrice,
        isActive: createProductDto.isActive ?? true,
        clientId: createProductDto.clientId,
      });

      if (createProductDto.categoryIds && createProductDto.categoryIds.length > 0) {
        const categories = await this.categoryRepository.findBy({
          id: In(createProductDto.categoryIds)
        });
        
        if (categories.length !== createProductDto.categoryIds.length) {
          throw new BadRequestException('One or more categories not found');
        }
        
        product.categories = categories;
      }

      await this.productRepo.save(product);

      if (createProductDto.variants && createProductDto.variants.length > 0) {
        await this.createVariantsForProduct(product, createProductDto.variants);
      }

      await queryRunner.commitTransaction();

      return this.findOne(product.id);
    } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Helper method to create variants for a product
   */
   async createVariantsForProduct(product: Product, variantDtos: any[]): Promise<void> {

    const activeAttributes = await this.attributeRepo.find({
      where: { isActive: true },  
      relations: { values: true }
    });

    const attributeValueIds = variantDtos.flatMap(
      variant => variant.attributeValues.map(av => av.attributeValueId)
    );
    

    const attributeValues = await this.attributeValueBaseRepo.find({
      where: { id: In(activeAttributes) },
      relations: {attribute: true }
    });

    if (attributeValues.length !== new Set(attributeValueIds).size) {
      throw new BadRequestException('One or more attribute values not found');
    }

    
    const attributeValueMap = new Map(
      attributeValues.map(av => [av.id, av])
    );

    
    const requiredAttributeIds = new Set(
      attributeValues.map(av => av.attribute.id)
    );

    // Process each variant
    for (const variantDto of variantDtos) {
      // Ensure the variant has all required attributes
      const variantAttributeIds = new Set(
        variantDto.attributeValues.map(av => av.attributeId)
      );
      
      // Check if all required attributes are present in this variant
      if (requiredAttributeIds.size !== variantAttributeIds.size || 
          ![...requiredAttributeIds].every(id => variantAttributeIds.has(id))) {
        throw new BadRequestException(
          `Variant ${variantDto.sku} is missing required attributes. All variants must define values for all attributes.`
        );
      }

      // Create the variant
      const variant = this.variantRepo.create({
        sku: variantDto.sku,
        priceAdjustment: variantDto.priceAdjustment || 0,
        stockQuantity: variantDto.stockQuantity || 0,
        isActive: variantDto.isActive ?? true,
        product: product
      });
      
      // Save the variant first to get an ID
      await this.variantRepo.save(variant);
      
      // Create attribute value associations
      const attributeValueEntities : ProductAttributeValue[] = [];
      for (const av of variantDto.attributeValues) {
        const attributeValue = attributeValueMap.get(av.attributeValueId);
        
        if (!attributeValue) {
          throw new BadRequestException(`Attribute value ${av.attributeValueId} not found`);
        }
        
        // Create the link between variant and attribute value
        const productAttributeValue = this.attributeValueRepo.create({
          variant: variant,
          attributeValue: attributeValue,
          attribute: attributeValue.attribute
        });
        
        attributeValueEntities.push(productAttributeValue);
      }
      
      // Save all attribute values for this variant
      if (attributeValueEntities.length > 0) {
        await this.attributeValueRepo.save(attributeValueEntities);
      }
    }
  }

  async findAllSimpleRest(
    params: SimpleRestParams,
  ): Promise<{ data: Product[]; total: number }> {
    const { start = 0, end = 9, sort, order = 'ASC', filters = {} } = params;
  
    // Calculate TypeORM pagination options
    const take = end - start + 1;
    const skip = start;
    
    // Build a query builder for more complex queries
    const queryBuilder = this.productRepo.createQueryBuilder('product')
      .leftJoinAndSelect('product.categories', 'category')
      .leftJoinAndSelect('product.variants', 'variant')
      .leftJoinAndSelect('variant.attributeValues', 'attrValue')
      .leftJoinAndSelect('attrValue.attributeValue', 'attributeValue')
      .leftJoinAndSelect('attrValue.attribute', 'attribute');
    
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
          // Handle attribute filter
          else if (key === 'attributeValueId' && filters[key]) {
            queryBuilder.andWhere('attributeValue.id = :attributeValueId', { 
              attributeValueId: filters[key] 
            });
          }
          // Handle regular fields
          else if (this.productRepo.metadata.hasColumnWithPropertyPath(key)) {
            queryBuilder.andWhere(`product.${key} = :${key}`, { [key]: filters[key] });
          } else {
            console.warn(`Ignoring invalid filter field: ${key}`);
          }
        }
      }
    }

    // Add sorting
    if (sort && this.productRepo.metadata.hasColumnWithPropertyPath(sort)) {
      queryBuilder.orderBy(`product.${sort}`, order.toUpperCase() as 'ASC' | 'DESC');
    } else {
      // Default sort
      queryBuilder.orderBy('product.id', 'ASC');
    }
    
    // Add pagination
    queryBuilder.skip(skip).take(take);
    
    // Execute the query
    const [data, total] = await queryBuilder.getManyAndCount();

    // Process the data to extract category IDs and variant info
    const processedData = data.map(product => {
      const productObj = { ...product };
      productObj['categoryIds'] = product.categories.map(category => category.id);
      
      // Calculate min/max prices from variants
      if (product.variants && product.variants.length) {
        const variantPrices = product.variants.map(v => 
          product.basePrice + (v.priceAdjustment || 0)
        );
        productObj['minPrice'] = Math.min(...variantPrices);
        productObj['maxPrice'] = Math.max(...variantPrices);
      } else {
        productObj['minPrice'] = product.basePrice;
        productObj['maxPrice'] = product.basePrice;
      }
      
      return productObj;
    });

    return { data: processedData as Product[], total };
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productRepo.findOne({ 
      where: { id },
      relations: {
        categories : true,
        variants: {
          attributeValues: {
            attributeValue: true,
            attribute: true
          }
        }
      }
    });
    
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    
    const categoryIds = product.categories.map(category => category.id);
    (product as any).categoryIds = categoryIds;
    
    return product;
  }

  async updateProduct(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const product = await this.productRepo.findOne({
        where: { id },
        relations: {
          categories: true,
        }
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }
      
      // Update basic product fields
      if (updateProductDto.name) product.name = updateProductDto.name;
      if (updateProductDto.description !== undefined) product.description = updateProductDto.description;
      if (updateProductDto.basePrice !== undefined) product.basePrice = updateProductDto.basePrice;
      if (updateProductDto.isActive !== undefined) product.isActive = updateProductDto.isActive;
      if (updateProductDto.sku) product.sku = updateProductDto.sku;

      // Update categories if provided
      if (updateProductDto.categoryIds) {
        if (updateProductDto.categoryIds.length > 0) {
          const categories = await this.categoryRepository.findBy({
            id: In(updateProductDto.categoryIds)
          });
          
          if (categories.length !== updateProductDto.categoryIds.length) {
            throw new BadRequestException('Invalid category ID provided');
          }
          
          product.categories = categories;
        } else {
          product.categories = [];
        }
      }
      console.log('>>> Updated product', product);

      await this.productRepo.save(product);
      await queryRunner.commitTransaction();

      return this.findOne(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Helper method to update variants for a product
   */
  private async updateProductVariants(product: Product, variantDtos: any[]): Promise<void> {
   
    const existingVariantIds = product.variants.map(v => v.id);
    
    const updateVariantIds = variantDtos
      .filter(v => v.id)
      .map(v => v.id);
    
    const variantsToDelete = product.variants.filter(
      variant => !updateVariantIds.includes(variant.id)
    );
    
    // Delete variants that are not in the update
    if (variantsToDelete.length > 0) {
      await this.variantRepo.remove(variantsToDelete);
    }
    
    // Process each variant in the update
    for (const variantDto of variantDtos) {
      if (variantDto.id) {
        // Update existing variant
        const existingVariant = product.variants.find(v => v.id === variantDto.id);
        if (existingVariant) {
          // Update basic variant fields
          if (variantDto.sku) existingVariant.sku = variantDto.sku;
          if (variantDto.priceAdjustment !== undefined) existingVariant.priceAdjustment = variantDto.priceAdjustment;
          if (variantDto.stockQuantity !== undefined) existingVariant.stockQuantity = variantDto.stockQuantity;
          if (variantDto.isActive !== undefined) existingVariant.isActive = variantDto.isActive;
          
          await this.variantRepo.save(existingVariant);
          
          // Update attribute values if provided
          if (variantDto.attributeValues && variantDto.attributeValues.length > 0) {
            await this.updateVariantAttributeValues(existingVariant, variantDto.attributeValues);
          }
        }
      } else {
        // Create new variant
        const newVariant = this.variantRepo.create({
          sku: variantDto.sku,
          priceAdjustment: variantDto.priceAdjustment || 0,
          stockQuantity: variantDto.stockQuantity || 0,
          isActive: variantDto.isActive ?? true,
          product: product
        });
        
        await this.variantRepo.save(newVariant);
        
        // Add attribute values for new variant
        if (variantDto.attributeValues && variantDto.attributeValues.length > 0) {
          await this.addAttributeValuesToVariant(newVariant, variantDto.attributeValues);
        }
      }
    }
  }

  /**
   * Helper method to update attribute values for a variant
   */
  private async updateVariantAttributeValues(variant: ProductVariant, attributeValueDtos: any[]): Promise<void> {
    
    const currentAttributeValues = await this.attributeValueRepo.find({
      where: { variant: { id: variant.id } },
      relations: {
        attributeValue: true,
        attribute: true}
    });
    
   
    const attributeValueIds = attributeValueDtos.map(av => av.attributeValueId);
    const attributeValues = await this.attributeValueBaseRepo.find({
      where: { id: In(attributeValueIds) },
      relations: {attribute: true}
    });
    
    const attributeValueMap = new Map(attributeValues.map(av => [av.id, av]));
    
    // Delete existing attribute values
    await this.attributeValueRepo.remove(currentAttributeValues);
    
    // Add new attribute values
    await this.addAttributeValuesToVariant(variant, attributeValueDtos);
  }

  /**
   * Helper method to add attribute values to a variant
   */
  private async addAttributeValuesToVariant(variant: ProductVariant, attributeValueDtos: any[]): Promise<void> {
    // Get all referenced attribute values
    const attributeValueIds = attributeValueDtos.map(av => av.attributeValueId);
    
    // Fetch all attribute values at once
    const attributeValues = await this.attributeValueBaseRepo.find({
      where: { id: In(attributeValueIds) },
      relations: {attribute: true}
    });
    
    if (attributeValues.length !== attributeValueIds.length) {
      throw new BadRequestException('One or more attribute values not found');
    }
    
    // Create a map for quick lookup
    const attributeValueMap = new Map(attributeValues.map(av => [av.id, av]));
    
    // Create attribute value associations
    const attributeValueEntities : ProductAttributeValue[] = [];
    for (const av of attributeValueDtos) {
      const attributeValue = attributeValueMap.get(av.attributeValueId);
      
      if (!attributeValue) {
        throw new BadRequestException(`Attribute value ${av.attributeValueId} not found`);
      }
      
      // Create the link between variant and attribute value
      const productAttributeValue = this.attributeValueRepo.create({
        variant: variant,
        attributeValue: attributeValue,
        attribute: attributeValue.attribute
      });
      
      attributeValueEntities.push(productAttributeValue);
    }
    
    // Save all attribute values for this variant
    if (attributeValueEntities.length > 0) {
      await this.attributeValueRepo.save(attributeValueEntities);
    }
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    await this.productRepo.remove(product);
  }
  
  /**
   * Find a product variant by ID
   */
  async findVariant(id: string): Promise<ProductVariant> {
    const variant = await this.variantRepo.findOne({
      where: { id },
      relations: {
        product : true,
        attributeValues: {
          attributeValue: true,
          attribute: true
        },
      }
    });
    
    if (!variant) {
      throw new NotFoundException(`Product variant with ID ${id} not found`);
    }
    
    return variant;
  }
  
  /**
   * Update stock quantity for a variant
   */
  async updateVariantStock(id: string, quantity: number): Promise<ProductVariant> {
    const variant = await this.findVariant(id);
    variant.stockQuantity = quantity;
    return this.variantRepo.save(variant);
  }

  /**
   * Find all variants for a given product ID
   */

  async findVariantsByProductId(productId: string): Promise<ProductVariant[]> {
    const productExists = await this.productRepo.findOneBy({ id: productId });
    if (!productExists) {
      throw new NotFoundException(`Product with ID ${productId} not found.`);
    }

   
    const variants = await this.variantRepo.find({
      where: {
        product: { id: productId }, 
      },
      relations: {
        attributeValues :{
          attribute: true,
          attributeValue: {
            attribute: true,
          }
        }                         
      },
      order: {
        sku: 'ASC', // Default order by SKU
      },
    });
    return variants;
  }
  

  async findPaginatedVariants(
    params: SimpleRestParams,
  ): Promise<{ data: ProductVariant[]; total: number }> {
    const { start = 0, end = 9, sort = "sku", order = 'ASC', filters = {} } = params;

    const take = end - start + 1;
    const skip = start;

   
    const queryBuilder = this.variantRepo.createQueryBuilder('variant')
        .leftJoinAndSelect('variant.product', 'product') 
        .leftJoinAndSelect('variant.attributeValues', 'pav')
        .leftJoinAndSelect('pav.attributeValue', 'attrValue')
        .leftJoinAndSelect('pav.attribute', 'attr'); 

    // --- Filtering ---
    const whereParams: { [key: string]: any } = {};
    if (filters) {
        for (const key in filters) {
            if (Object.prototype.hasOwnProperty.call(filters, key) && filters[key] !== undefined && filters[key] !== null) {
                const filterValue = filters[key];

                if (key === 'productId') {
                    console.log(`>>> Applying productId filter with value: ${filterValue}`);
                    queryBuilder.andWhere('variant.product.id = :productId', { productId: filterValue });
                    whereParams.productId = filterValue; 
                }

                else if (key === 'sku') {
                     queryBuilder.andWhere('variant.sku ILIKE :sku', { sku: `%${filterValue}%` });
                }

                else if (key === 'id' && Array.isArray(filterValue) && filterValue.length > 0) {
                     queryBuilder.andWhere('variant.id IN (:...variantIds)', { variantIds: filterValue });
                }

                else if (key === "stockQuantity") {
                    queryBuilder.andWhere('variant.stockQuantity < :stockQuantity', { stockQuantity: filterValue });
                }
                else if (key === "name") {
                    queryBuilder.andWhere('product.name ILIKE :name', { name: `%${filterValue}%` });
                }
                else {
                    console.warn(`VariantsService: Ignoring unknown filter key: ${key}`);
                }
            }
        }
    }

    // --- Sorting ---
    if (this.variantRepo.metadata.hasColumnWithPropertyPath(sort)) {
         queryBuilder.orderBy(`variant.${sort}`, order.toUpperCase() as 'ASC' | 'DESC');
    } else {
         queryBuilder.orderBy('variant.sku', 'ASC'); // Default sort
    }


    // --- Pagination ---
    queryBuilder.skip(skip).take(take);

    // --- Execution ---
    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total };
  }


  async addVariantToProduct(createVariantDto: CreateProductVariantDto): Promise<ProductVariant> {

    const currentUserRoles = this.cls.get('userRoles') as Role[] | undefined;
    const currentUserClientId = this.cls.get('clientId') as string | undefined;
    if (!currentUserRoles || !currentUserClientId) {
      throw new InternalServerErrorException('User context not found.');
    }
    const isSuperAdmin = currentUserRoles.includes(Role.SuperAdmin);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const product = await queryRunner.manager.findOne(Product, {
        where: { id: createVariantDto.productId },
      });
      if (!product) {
        throw new NotFoundException(`Product with ID ${createVariantDto.productId} not found.`);
      }

      const finalClientId = product.clientId;
      if(!isSuperAdmin) {
        if(product.clientId !== currentUserClientId) {
          throw new ForbiddenException('You do not have permission to add variants to this product.');
        }
        console.log(`Admin creating variant for product with clientId ${finalClientId}`);
      } else {
        console.log(`SuperAdmin creating variant for product with clientId ${finalClientId}`);
      }

      const attributeValueIds = createVariantDto.attributeValues.map(av => av.attributeValueId);
      if (new Set(attributeValueIds).size !== attributeValueIds.length) {
        throw new BadRequestException('Duplicate attributeValueId provided for the variant.');
      }

      const attributeValues = await queryRunner.manager.find(AttributeValue, {
        where: { id: In(attributeValueIds) },
        relations: {attribute : true} 
      });

      if (attributeValues.length !== attributeValueIds.length) {
        const foundIds = attributeValues.map(av => av.id);
        const missingIds = attributeValueIds.filter(id => !foundIds.includes(id));
        throw new BadRequestException(`Attribute values not found: ${missingIds.join(', ')}`);
      }

      // For future reference here check if variant exists? Based on bussiness logic
      // refuse to create a variant that already exists for the product. Bon Courage et Hala Madrid!


      const newVariant = queryRunner.manager.create(ProductVariant, {
        sku: createVariantDto.sku,
        priceAdjustment: createVariantDto.priceAdjustment ?? 0,
        stockQuantity: createVariantDto.stockQuantity ?? 0,
        isActive: createVariantDto.isActive ?? true,
        product: { id: product.id },
        clientId: finalClientId,
      });

      await queryRunner.manager.save(ProductVariant, newVariant);


      const productAttributeValueEntities = attributeValues.map(attrValue => {
          return queryRunner.manager.create(ProductAttributeValue, {
              variant: newVariant, 
              attributeValue: attrValue, 
              attribute: attrValue.attribute,
              clientId: finalClientId, 
          });
      });

      await queryRunner.manager.save(ProductAttributeValue, productAttributeValueEntities);

      await queryRunner.commitTransaction();

      const createdVariant = await this.variantRepo.findOne({
        where: { id: newVariant.id },
        relations: {
          product: true,
          attributeValues: {
            attributeValue: true,
            attribute: true
          }, 
        }
      });
      if(!createdVariant) {
        throw new InternalServerErrorException('Failed to retrieve created variant after transaction.');
      }
      return createdVariant;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error("Error adding variant to product:", error);
       if (error instanceof BadRequestException || error instanceof ForbiddenException || error instanceof NotFoundException) {
           throw error;
       }
       if (error.code === '23505') {
           throw new ConflictException(`Variant creation failed: ${error.detail || 'Duplicate value detected.'}`);
       }
      throw new InternalServerErrorException(`Failed to add variant: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Update a product variant
   */
  async updateVariant(
    variantId: string,
    updateDto: UpdateProductVariantDto,
  ): Promise<ProductVariant> {
    console.log('>>> Received variantId:', variantId);
    console.log('>>> Received updateDto:', JSON.stringify(updateDto, null, 2));
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Find the existing variant with its current attributes
      const variant = await queryRunner.manager.findOne(ProductVariant, {
        where: { id: variantId },
        relations: {
          attributeValues: {
            attribute: true,
            attributeValue: true,
          },
        },
      });

      if (!variant) {
        throw new NotFoundException(`Oops, Product variant with ID ${variantId} not found`);
      }

      console.log('>>> Found existing variant:', variant);

      // 2. Update basic variant fields if provided
      if (updateDto.sku !== undefined) variant.sku = updateDto.sku;
      if (updateDto.priceAdjustment !== undefined) variant.priceAdjustment = updateDto.priceAdjustment;
      if (updateDto.stockQuantity !== undefined) variant.stockQuantity = updateDto.stockQuantity;
      if (updateDto.isActive !== undefined) variant.isActive = updateDto.isActive;
      

      // Save the basic variant fields first
      await queryRunner.manager.save(ProductVariant, variant);

      // 3. Handle attribute value updates if provided
      if (updateDto.attributeValues && updateDto.attributeValues.length > 0) {
        console.log('>>> Validating attribute values:', updateDto.attributeValues);
        
        // Get new attribute value IDs
        const newAttributeValueIds = updateDto.attributeValues.map(av => av.attributeValueId);
        console.log('>>> New attribute value IDs:', newAttributeValueIds);

        // Fetch the new attribute values with their attribute relations
        const newAttributeValues = await queryRunner.manager.find(AttributeValue, {
            where: { id: In(newAttributeValueIds) },
            relations: {
              attribute: true,
            }, 
        });

        if (newAttributeValues.length !== newAttributeValueIds.length) {
            const foundIds = newAttributeValues.map(v => v.id);
            const missingIds = newAttributeValueIds.filter(id => !foundIds.includes(id));
            throw new BadRequestException(`Attribute values not found: ${missingIds.join(', ')}`);
        }

        // Create a map for efficient lookup
        const newValueMap = new Map(newAttributeValues.map(v => [v.id, v]));

        // Validate relationships between attributes and values
        for (const dtoValue of updateDto.attributeValues) {
            const newValue = newValueMap.get(dtoValue.attributeValueId);
            if (newValue?.attribute.id !== dtoValue.attributeId) {
                throw new BadRequestException(`AttributeValue ID ${dtoValue.attributeValueId} does not belong to Attribute ID ${dtoValue.attributeId}.`);
            }
        }

        // First, explicitly delete all old ProductAttributeValue links
        if (variant.attributeValues && variant.attributeValues.length > 0) {
            const oldAttributeValueIds = variant.attributeValues.map(av => av.id);
            if (oldAttributeValueIds.length > 0) {
                await queryRunner.manager.delete(ProductAttributeValue, oldAttributeValueIds);
            }
        }

        // Now create completely new ProductAttributeValue entities (don't reuse IDs)
        const newLinks: ProductAttributeValue[] = [];
        for (const dtoValue of updateDto.attributeValues) {
            const correspondingValue = newValueMap.get(dtoValue.attributeValueId);
            console.log('>>> Creating new link for attribute value:', correspondingValue);
            
            if (!correspondingValue) {
                throw new InternalServerErrorException(`Failed to find validated AttributeValue ${dtoValue.attributeValueId}`);
            }
            
            // Create new instance without specifying existing IDs
            const newLink = queryRunner.manager.create(ProductAttributeValue, {
              variant: { id: variant.id }, 
              attributeValue: correspondingValue, 
              attribute: correspondingValue.attribute, 
            });
            
            newLinks.push(newLink);
        }

        // Save the new links if there are any
        if (newLinks.length > 0) {
            await queryRunner.manager.save(ProductAttributeValue, newLinks);
        }
      }

      // Commit the transaction
      await queryRunner.commitTransaction();

      // Fetch and return the updated variant with all its relations
      const updatedVariant = await this.variantRepo.findOne({
          where: { id: variantId },
          relations: {
              product: true,
              attributeValues: {
                  attributeValue: true,
                  attribute: true
              },
          },
      });

      if (!updatedVariant) {
          throw new InternalServerErrorException('Failed to retrieve updated variant after transaction.');
      }
      return updatedVariant;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Delete a product variant by ID
   */
  async removeVariant(id: string): Promise<void> {
    const variant = await this.findVariant(id);
    await this.variantRepo.remove(variant);
  }

}