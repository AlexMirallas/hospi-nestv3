import { Injectable, NotFoundException, BadRequestException,InternalServerErrorException } from '@nestjs/common';
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


@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
    @InjectRepository(ProductVariant)
    private variantRepo: Repository<ProductVariant>,
    @InjectRepository(ProductAttributeValue)
    private attributeValueRepo: Repository<ProductAttributeValue>,
    @InjectRepository(AttributeValue)
    private attributeValueBaseRepo: Repository<AttributeValue>,
    @InjectRepository(Attribute)
    private attributeRepo: Repository<Attribute>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    private dataSource: DataSource
  ) {}

  /**
   * Create a product with variants
   */
  async create(createProductDto: CreateProductDto): Promise<Product> {
    
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const product = this.productRepo.create({
        sku: createProductDto.sku,
        name: createProductDto.name,
        description: createProductDto.description,
        basePrice: createProductDto.basePrice,
        isActive: createProductDto.isActive ?? true
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

      // 3. Save the base product 
      await this.productRepo.save(product);

      // 4. Create variants if provided
      if (createProductDto.variants && createProductDto.variants.length > 0) {
        await this.createVariantsForProduct(product, createProductDto.variants);
      }

      // Commit transaction
      await queryRunner.commitTransaction();

      // Return the product with variants
      return this.findOne(product.id);
    } catch (error) {
      // Rollback transaction on error
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }

  /**
   * Helper method to create variants for a product
   */
   async createVariantsForProduct(product: Product, variantDtos: any[]): Promise<void> {
    // Get all referenced attribute values to validate
    const attributeValueIds = variantDtos.flatMap(
      variant => variant.attributeValues.map(av => av.attributeValueId)
    );
    
    
    const attributeValues = await this.attributeValueBaseRepo.find({
      where: { id: In(attributeValueIds) },
      relations: {attribute: true}
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

    // Add categoryIds property for convenience
    const categoryIds = product.categories.map(category => category.id);
    (product as any).categoryIds = categoryIds;
    
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    // Start a transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const product = await this.productRepo.findOne({
        where: { id },
        relations: {
          categories: true,
          variants: true,
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

      // Save the updated product
      await this.productRepo.save(product);

      // Handle variants updates if provided
      if (updateProductDto.variants) {
        // Update existing variants and add new ones
        await this.updateProductVariants(product, updateProductDto.variants);
      }

      // Commit transaction
      await queryRunner.commitTransaction();

      // Return updated product with variants
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
    // Get IDs of existing variants
    const existingVariantIds = product.variants.map(v => v.id);
    
    // Extract variant IDs from the update DTOs
    const updateVariantIds = variantDtos
      .filter(v => v.id)
      .map(v => v.id);
    
    // Find variants to delete (those that exist but aren't in the update)
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
    // Load current attribute values
    const currentAttributeValues = await this.attributeValueRepo.find({
      where: { variant: { id: variant.id } },
      relations: {
        attributeValue: true,
        attribute: true}
    });
    
    // Get all attribute values referenced
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

    // Start QueryBuilder for ProductVariant
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
        product: product, 
      });


      await queryRunner.manager.save(ProductVariant, newVariant);


      const productAttributeValueEntities = attributeValues.map(attrValue => {
          return queryRunner.manager.create(ProductAttributeValue, {
              variant: newVariant, 
              attributeValue: attrValue, 
              attribute: attrValue.attribute, 
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
        throw new Error('Failed to retrieve created variant after transaction.');
      }
      return createdVariant;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Update a product variant
   */
  async updateVariant(id: string, updateVariantDto: UpdateProductVariantDto): Promise<ProductVariant> {
    const variant = await this.findVariant(id);
    
    if (!variant) {
      throw new NotFoundException(`Product variant with ID ${id} not found`);
    }

    if (updateVariantDto.sku) variant.sku = updateVariantDto.sku;
    if (updateVariantDto.priceAdjustment !== undefined) variant.priceAdjustment = updateVariantDto.priceAdjustment;
    if (updateVariantDto.stockQuantity !== undefined) variant.stockQuantity = updateVariantDto.stockQuantity;
    if (updateVariantDto.isActive !== undefined) variant.isActive = updateVariantDto.isActive;

    if (updateVariantDto.attributeValues) {
      const attributeValueIds = updateVariantDto.attributeValues.map(av => av.attributeValueId);
      const attributeValues = await this.attributeValueBaseRepo.find({
        where: { id: In(attributeValueIds) },
        relations: {attribute: true}
      });

      const attributeValueMap = new Map(attributeValues.map(av => [av.id, av]));
      const attributeValueEntities: ProductAttributeValue[] = [];
      
      for (const av of updateVariantDto.attributeValues) {
        const attributeValue = attributeValueMap.get(av.attributeValueId);
        if (!attributeValue) {
          throw new BadRequestException(`Attribute value ${av.attributeValueId} not found`);
        }
        const productAttributeValue = this.attributeValueRepo.create({
          variant: variant,
          attributeValue: attributeValue,
          attribute: attributeValue.attribute
        });
        attributeValueEntities.push(productAttributeValue);
      }

      await this.attributeValueRepo.remove(variant.attributeValues);
      variant.attributeValues = attributeValueEntities;
      if (attributeValueEntities.length > 0) {
        await this.attributeValueRepo.save(attributeValueEntities);
      }
    }

    return this.variantRepo.save(variant);

  }
  /**
   * Delete a product variant by ID
   */
  async removeVariant(id: string): Promise<void> {
    const variant = await this.findVariant(id);
    await this.variantRepo.remove(variant);
  }

}