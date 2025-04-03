import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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
    // Start a transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create the base product
      const product = this.productRepo.create({
        sku: createProductDto.sku,
        name: createProductDto.name,
        description: createProductDto.description,
        basePrice: createProductDto.basePrice,
        isActive: createProductDto.isActive ?? true
      });

      // 2. Add categories if provided
      if (createProductDto.categoryIds && createProductDto.categoryIds.length > 0) {
        const categories = await this.categoryRepository.findBy({
          id: In(createProductDto.categoryIds)
        });
        
        if (categories.length !== createProductDto.categoryIds.length) {
          throw new BadRequestException('One or more categories not found');
        }
        
        product.categories = categories;
      }

      // 3. Save the base product first
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
    
    // Fetch all attribute values at once
    const attributeValues = await this.attributeValueBaseRepo.find({
      where: { id: In(attributeValueIds) },
      relations: ['attribute']
    });

    if (attributeValues.length !== new Set(attributeValueIds).size) {
      throw new BadRequestException('One or more attribute values not found');
    }

    // Create a map for quick lookup
    const attributeValueMap = new Map(
      attributeValues.map(av => [av.id, av])
    );

    // Required attributes for this product (defined by what's used in variants)
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
      relations: [
        'categories', 
        'variants',
        'variants.attributeValues',
        'variants.attributeValues.attributeValue', 
        'variants.attributeValues.attribute'
      ] 
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
        relations: ['categories', 'variants']
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
      relations: ['attributeValue', 'attribute']
    });
    
    // Get all attribute values referenced
    const attributeValueIds = attributeValueDtos.map(av => av.attributeValueId);
    const attributeValues = await this.attributeValueBaseRepo.find({
      where: { id: In(attributeValueIds) },
      relations: ['attribute']
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
      relations: ['attribute']
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
      relations: [
        'product',
        'attributeValues',
        'attributeValues.attributeValue',
        'attributeValues.attribute'
      ]
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

  // return variants for a product 

  async findVariantsByProductId(productId: string): Promise<ProductVariant[]> {
    // Optional: Check if the product actually exists first
    const productExists = await this.productRepo.findOneBy({ id: productId });
    if (!productExists) {
      throw new NotFoundException(`Product with ID ${productId} not found.`);
    }

    // Find all variants where the relation 'product.id' matches the given productId
    const variants = await this.variantRepo.find({
      where: {
        product: { id: productId }, // Filter by the nested product ID through the relation
      },
      relations: [
        // Specify relations needed to populate variant details for the frontend
        'attributeValues',                    // The join entity ProductAttributeValue
        'attributeValues.attributeValue',     // The actual AttributeValue entity (e.g., 'Red', 'S')
        'attributeValues.attributeValue.attribute', // The parent Attribute entity ('Color', 'Size') - useful for display text
        'attributeValues.attribute',          // The Attribute entity directly linked in ProductAttributeValue (if you added it)
      ],
      order: {
        // Optional 
        sku: 'ASC', // Example: Sort by SKU ascending
        // id: 'ASC'
      },
    });

    // It's okay to return an empty array if a product exists but has no variants.
    // No need to throw NotFoundException here unless the product itself wasn't found (handled above).
    return variants;
  }
  // Inside ProductsService class

async findPaginatedVariants(
  params: SimpleRestParams,
): Promise<{ data: ProductVariant[]; total: number }> {
  const { start = 0, end = 9, sort = "sku", order = 'ASC', filters = {} } = params;

  console.log('findPaginatedVariants received filters:', JSON.stringify(filters, null, 2));

  const take = end - start + 1;
  const skip = start;

  // Start QueryBuilder for ProductVariant
  const queryBuilder = this.variantRepo.createQueryBuilder('variant')
      .leftJoinAndSelect('variant.product', 'product') // Need product relation for filtering
      .leftJoinAndSelect('variant.attributeValues', 'pav')
      .leftJoinAndSelect('pav.attributeValue', 'attrValue')
      .leftJoinAndSelect('pav.attribute', 'attr'); // Join necessary relations for display

  // --- Filtering ---
  const whereParams: { [key: string]: any } = {};
  if (filters) {
      for (const key in filters) {
          if (Object.prototype.hasOwnProperty.call(filters, key) && filters[key] !== undefined && filters[key] !== null) {
              const filterValue = filters[key];

              if (key === 'productId') {
                  // Filter by the product ID using the joined relation
                  console.log(`>>> Applying productId filter with value: ${filterValue}`);
                  queryBuilder.andWhere('variant.product.id = :productId', { productId: filterValue });
                  whereParams.productId = filterValue; // Keep track if needed, though QB handles it
              }
              // Add other variant-specific filters here if needed (e.g., filter by SKU)
              else if (key === 'sku') {
                   queryBuilder.andWhere('variant.sku ILIKE :sku', { sku: `%${filterValue}%` });
              }
              // Handle variant ID filter (e.g., for getMany)
              else if (key === 'id' && Array.isArray(filterValue) && filterValue.length > 0) {
                   queryBuilder.andWhere('variant.id IN (:...variantIds)', { variantIds: filterValue });
              }
              // ... add more filters as necessary ...
              else {
                  console.warn(`VariantsService: Ignoring unknown filter key: ${key}`);
              }
          }
      }
  }

  // --- Sorting ---
  // Add sorting logic based on 'sort' and 'order' params for variant fields
  // Example:
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
    // 1. Find the parent product
    const product = await queryRunner.manager.findOne(Product, {
      where: { id: createVariantDto.productId },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${createVariantDto.productId} not found.`);
    }

    // 2. Validate Attribute Values
    const attributeValueIds = createVariantDto.attributeValues.map(av => av.attributeValueId);
    if (new Set(attributeValueIds).size !== attributeValueIds.length) {
      throw new BadRequestException('Duplicate attributeValueId provided for the variant.');
    }

    const attributeValues = await queryRunner.manager.find(AttributeValue, {
      where: { id: In(attributeValueIds) },
      relations: ['attribute'], // Need attribute for validation/association
    });

    if (attributeValues.length !== attributeValueIds.length) {
      const foundIds = attributeValues.map(av => av.id);
      const missingIds = attributeValueIds.filter(id => !foundIds.includes(id));
      throw new BadRequestException(`Attribute values not found: ${missingIds.join(', ')}`);
    }

    // Optional: Check if variant with this exact combination already exists for this product
    // This requires a more complex query joining ProductVariant and ProductAttributeValue
    // For simplicity, we'll skip this strict check for now, but consider adding it
    // based on business rules. You might allow duplicates if SKUs are different, etc.

    // 3. Create the ProductVariant
    const newVariant = queryRunner.manager.create(ProductVariant, {
      sku: createVariantDto.sku,
      priceAdjustment: createVariantDto.priceAdjustment ?? 0,
      stockQuantity: createVariantDto.stockQuantity ?? 0,
      isActive: createVariantDto.isActive ?? true,
      product: product, // Link to the parent product
    });

    // Save the variant to get its ID
    await queryRunner.manager.save(ProductVariant, newVariant);

    // 4. Create ProductAttributeValue associations
    const productAttributeValueEntities = attributeValues.map(attrValue => {
        return queryRunner.manager.create(ProductAttributeValue, {
            variant: newVariant, // Link to the new variant
            attributeValue: attrValue, // Link to the specific AttributeValue (e.g., 'Red')
            attribute: attrValue.attribute, // Link to the parent Attribute (e.g., 'Color')
        });
    });

    // Save the associations
    await queryRunner.manager.save(ProductAttributeValue, productAttributeValueEntities);

    // 5. Commit Transaction
    await queryRunner.commitTransaction();

    // 6. Return the newly created variant (potentially reload with relations if needed)
    // Fetching again ensures all relations are loaded as expected by the frontend
    const createdVariant = await this.variantRepo.findOne({
      where: { id: newVariant.id },
      relations: [
        'product', // Include product info if needed
        'attributeValues',
        'attributeValues.attributeValue',
        'attributeValues.attribute'
      ]
    });
    if(!createdVariant) {
      // Should not happen if transaction succeeded, but good practice
      throw new Error('Failed to retrieve created variant after transaction.');
    }
    return createdVariant;

  } catch (error) {
    // Rollback on error
    await queryRunner.rollbackTransaction();
    // Re-throw the error to be handled by NestJS exception filters
    throw error;
  } finally {
    // Release the query runner
    await queryRunner.release();
  }
}

}