import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, ForbiddenException,ConflictException } from '@nestjs/common';
import { InjectRepository, } from '@nestjs/typeorm';
import { Repository, In, DataSource, QueryRunner } from 'typeorm';
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

    private ProductRepo: ProductRepository,
    
    private VariantRepo: ProductVariantRepository,
    
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
  async create(createProductDto: CreateProductDto): Promise<Product | undefined> {
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
    console.log(`>>> Determined final Client ID: ${finalClientId}`);

    try {
      // 1. Create the product entity using queryRunner.manager
      // queryRunner.manager.create returns a single entity instance (Product)
      const product = queryRunner.manager.create(Product, { // Use queryRunner.manager.create
        sku: createProductDto.sku,
        name: createProductDto.name,
        description: createProductDto.description,
        basePrice: createProductDto.basePrice,
        isActive: createProductDto.isActive ?? true,
        clientId: finalClientId, // Use the determined finalClientId
      });

      // 2. Handle categories using queryRunner.manager
      if (createProductDto.categoryIds && createProductDto.categoryIds.length > 0) {
        // Fetch categories using the transaction manager to ensure consistency
        // Note: categoryRepository.findBy might apply tenant filtering based on CLS,
        // using queryRunner.manager.findBy bypasses that unless manually added.
        // Ensure categories belong to the finalClientId if Category is tenant-specific.
        const categories = await queryRunner.manager.findBy(Category, { // Use queryRunner.manager.findBy
          id: In(createProductDto.categoryIds),
          clientId: finalClientId
        });

        if (categories.length !== createProductDto.categoryIds.length) {
           // Find which IDs were not found
           const foundIds = categories.map(c => c.id);
           const missingIds = createProductDto.categoryIds.filter(id => !foundIds.includes(parseInt(id)));
           console.error(`Categories not found or inaccessible for client ${finalClientId}: ${missingIds.join(', ')}`);
           throw new BadRequestException(`One or more categories not found or not accessible: ${missingIds.join(', ')}`);
        }

        // Assign categories - 'product' is correctly typed as Product here
        product.categories = categories;

      // 3. Save the product using queryRunner.manager
      // queryRunner.manager.save returns the saved entity (Product)
      await queryRunner.manager.save(Product, product); // Use queryRunner.manager.save

      // 4. Create variants if provided (pass queryRunner)
      if (createProductDto.variants && createProductDto.variants.length > 0) {
        // Ensure createVariantsForProduct uses queryRunner.manager internally
        await this.createVariantsForProduct(product, createProductDto.variants, queryRunner); // Pass queryRunner
      }

      // Commit transaction
      await queryRunner.commitTransaction();

      // Return the product using the standard findOne (which uses the custom repository filtering)
      // Fetch outside the transaction to get the final state with relations
      return this.findOne(product.id);
    }

    } catch (error) {
        await queryRunner.rollbackTransaction();
        console.error("Error during product creation:", error);
         if (error instanceof BadRequestException || error instanceof ForbiddenException || error instanceof NotFoundException || error instanceof ConflictException) {
             throw error;
         }
         if (error.code === '23505') {
             throw new ConflictException(`Product creation failed: ${error.detail || 'Duplicate value detected.'}`);
         }
        throw new InternalServerErrorException(`Failed to create product: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Helper method to create variants for a product
   */
  private async createVariantsForProduct(product: Product, variantDtos: any[], queryRunner: QueryRunner): Promise<void> {

    // 1. Aggregate all required AttributeValue IDs from all variant DTOs
    const allAttributeValueIds = variantDtos.flatMap(
        variantDto => variantDto.attributeValues?.map((av: { attributeValueId: string }) => av.attributeValueId) ?? []
    ).filter(id => id); // Filter out any potential null/undefined IDs

    if (allAttributeValueIds.length === 0 && variantDtos.some(dto => dto.attributeValues?.length > 0)) {
        throw new BadRequestException('Attribute value IDs are missing in variant DTOs.');
    }

    let attributeValueMap = new Map<string, AttributeValue>();

    // 2. Fetch all required AttributeValue entities if any IDs were provided
    if (allAttributeValueIds.length > 0) {
        const uniqueAttributeValueIds = [...new Set(allAttributeValueIds)]; // Ensure uniqueness

        let idsForQuery: (string | number)[];
        try {
             // Assuming AttributeValue.id is number, convert for DB query
             idsForQuery = uniqueAttributeValueIds.map(idStr => {
                 const num = parseInt(idStr, 10);
                 if (isNaN(num)) throw new Error(`Invalid attribute value ID format: ${idStr}`);
                 return num;
             });
        } catch (e) {
             throw new BadRequestException(e.message || 'Invalid attribute value ID format.');
        }

        // Fetch using the transaction's entity manager
        const fetchedAttributeValues = await queryRunner.manager.find(AttributeValue, {
            where: {
                id: In(uniqueAttributeValueIds),
                clientId: product.clientId
            },
            relations: { attribute: true } // Ensure the parent attribute is loaded
        });

        // Validate that all requested attribute values were found
        if (fetchedAttributeValues.length !== uniqueAttributeValueIds.length) {
            const foundDbIds = fetchedAttributeValues.map(av => av.id); // These are numbers from DB
            // Find which original STRING IDs were not found by converting found DB IDs back to string for comparison
            const foundDbIdsAsStrings = foundDbIds.map(idNum => idNum.toString());
            const missingIds = uniqueAttributeValueIds.filter(idStr => !foundDbIdsAsStrings.includes(idStr));
            console.error(`Attribute values not found or inaccessible for client ${product.clientId}: ${missingIds.join(', ')}`);
            throw new BadRequestException(`Attribute values not found or inaccessible: ${missingIds.join(', ')}`);
        }

        // Create a map for easy lookup
        attributeValueMap = new Map(fetchedAttributeValues.map(av => [av.id.toString(), av]));
    }


    // 3. Loop through each variant DTO to create the variant and its links
    for (const variantDto of variantDtos) {
        // Basic validation for the DTO structure
        if (!variantDto.sku) { // Add other necessary checks
            throw new BadRequestException('Variant SKU is required.');
        }

    const variant = queryRunner.manager.create(ProductVariant, {
            sku: variantDto.sku,
            priceAdjustment: variantDto.priceAdjustment ?? 0,
            stockQuantity: variantDto.stockQuantity ?? 0,
            isActive: variantDto.isActive ?? true,
            clientId: product.clientId, // Assign the parent product's clientId
            product: { id: product.id } // Link to the parent product by ID
        });

        // Save the ProductVariant using the transaction's entity manager
        await queryRunner.manager.save(ProductVariant, variant);

        // Create ProductAttributeValue links if attribute values are provided for this variant
        const attributeValueEntities: ProductAttributeValue[] = [];
        if (variantDto.attributeValues && variantDto.attributeValues.length > 0) {
            const attributeIdsInVariant = new Set<string>();

            for (const dtoAttributeValue of variantDto.attributeValues) {
                const attributeValueId = dtoAttributeValue.attributeValueId; // This is a STRING
                if (!attributeValueId) {
                    // ... error handling ...
                }

                // --- FIX 3: Lookup uses STRING key (attributeValueId) - Now matches map type ---
                const currentAttributeValue = attributeValueMap.get(attributeValueId);

                if (!currentAttributeValue) { // This check is now valid (line ~220)
                    // This should not happen if the initial fetch and validation passed
                    throw new InternalServerErrorException(`Could not find fetched attribute value for ID: ${attributeValueId}`);
                }
                const attributeIdAsString = currentAttributeValue.attribute.id.toString();
                // ... rest of the loop ...
                 if (attributeIdsInVariant.has(attributeIdAsString)) {
                     throw new BadRequestException(`Variant SKU ${variantDto.sku} cannot have multiple values for the same attribute (Attribute ID: ${currentAttributeValue.attribute.id}).`);
                 }
                  attributeIdsInVariant.add(attributeIdAsString);

                const productAttributeValue = queryRunner.manager.create(ProductAttributeValue, {
                     variant: { id: variant.id },
                     attributeValue: { id: currentAttributeValue.id }, // Use numeric ID here if relation expects number
                     attribute: { id: currentAttributeValue.attribute.id }, // Use numeric ID here if relation expects number
                     clientId: product.clientId,
                 });
                attributeValueEntities.push(productAttributeValue);
            }

            // Save all the linking entities for this variant using the transaction's entity manager
            if (attributeValueEntities.length > 0) {
                await queryRunner.manager.save(ProductAttributeValue, attributeValueEntities);
            }
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
    const queryBuilder = this.ProductRepo.createQueryBuilder('product')
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
          else if (this.ProductRepo.metadata.hasColumnWithPropertyPath(key)) {
            queryBuilder.andWhere(`product.${key} = :${key}`, { [key]: filters[key] });
          } else {
            console.warn(`Ignoring invalid filter field: ${key}`);
          }
        }
      }
    }

    // Add sorting
    if (sort && this.ProductRepo.metadata.hasColumnWithPropertyPath(sort)) {
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
    const product = await this.ProductRepo.findOne({ 
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
      const product = await this.ProductRepo.findOne({
        where: { id },
        relations: {
          categories: true,
        }
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }
      
      if (!isSuperAdmin && product.clientId !== currentUserClientId) {
        console.warn(`Admin ${currentUserClientId} attempting to update product ${product.id} owned by client ${product.clientId}.`);
        throw new ForbiddenException(`You do not have permission to update this product `);
    }
      // Update basic product fields
      console.log('>>> Updating product with ID:', id, 'with data:', updateProductDto);
      queryRunner.manager.merge(Product, product, {
        name: updateProductDto.name,
        description: updateProductDto.description,
        basePrice: updateProductDto.basePrice,
        isActive: updateProductDto.isActive,
        sku: updateProductDto.sku,
    })

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

      await queryRunner.manager.save(Product, product);
      await queryRunner.commitTransaction();

      return this.findOne(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error("Error updating product:", error);
      if (error instanceof BadRequestException || error instanceof ForbiddenException || error instanceof NotFoundException) {
          throw error;
      }
      if (error.code === '23505') { // Handle unique constraint errors (e.g., SKU)
          throw new ConflictException(`Product update failed: ${error.detail || 'Duplicate value detected.'}`);
      }
      throw new InternalServerErrorException(`Failed to update product: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }
  

  async remove(id: string): Promise<void> {
    const currentUserRoles = this.cls.get('userRoles') as Role[] | undefined;
    const currentUserClientId = this.cls.get('clientId') as string | undefined;
    if (!currentUserRoles || !currentUserClientId) {
      throw new InternalServerErrorException('User context not found.');
    }
    const isSuperAdmin = currentUserRoles.includes(Role.SuperAdmin);
    
    const product = await this.ProductRepo.findOneBy({ id });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    if (!isSuperAdmin && product.clientId !== currentUserClientId) {
      console.warn(`Admin ${currentUserClientId} attempting to delete product ${product.id} owned by client ${product.clientId}.`);
      throw new ForbiddenException(`You do not have permission to delete products for client ${product.clientId}.`);
  }
    try{
      await this.ProductRepo.remove(product);
    }catch(error){
      console.error("Error deleting product:", error);
      throw new InternalServerErrorException(`Failed to delete product: ${error.message}`);
    }
    
  }
}