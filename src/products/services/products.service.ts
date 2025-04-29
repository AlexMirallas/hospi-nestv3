import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, ForbiddenException,ConflictException } from '@nestjs/common';
import { InjectRepository, } from '@nestjs/typeorm';
import { Repository, In, DataSource, QueryRunner } from 'typeorm';
import { Product } from '../entities/product.entity';
import { ProductVariant } from '../entities/product-variant.entity';
import { ProductAttributeValue } from '../entities/product-attribute-value.entity';
import { CreateProductDto } from '../dto/create/create-product.dto';
import { UpdateProductDto } from '../dto/update/update-product.dto';
import { SimpleRestParams } from '../../common/pipes/parse-simple-rest.pipe';
import { Category } from '../../categories/entities/category.entity';
import { AttributeValue } from '../../attributes/entities/attribute-value.entity';
import { ProductRepository } from '../repositories/product.repository';
import { ProductVariantRepository } from '../repositories/product-variant.repository';
import { AttributeValueRepository } from '../../attributes/repositories/attribute-value.repository';
import { AttributeRepository } from '../../attributes/repositories/attribute.repository';
import { CategoryRepository } from '../../categories/repositories/category.repository';
import { ClsService } from 'nestjs-cls';
import { Role } from '../../common/enums/role.enum';
import { StockService } from 'src/stock/stock.service';
import { StockMovementType } from '../../common/enums/stock-movement.enum';


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
    private readonly stockService: StockService
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
    await queryRunner.startTransaction('SERIALIZABLE');

    console.log('>>> Received createProductDto:', createProductDto);
    console.log(`>>> Determined final Client ID: ${finalClientId}`);

    try {
    
      const product = queryRunner.manager.create(Product, { 
        sku: createProductDto.sku,
        name: createProductDto.name,
        description: createProductDto.description,
        basePrice: createProductDto.basePrice,
        isActive: createProductDto.isActive ?? true,
        clientId: finalClientId,
        trackInventory: createProductDto.trackInventory ?? true,
        initialStock: createProductDto.initialStock ?? 0, 
      });

      
      if (createProductDto.categoryIds && createProductDto.categoryIds.length > 0) {
        const categories = await queryRunner.manager.findBy(Category, { 
          id: In(createProductDto.categoryIds),
          clientId: finalClientId
        });

        if (categories.length !== createProductDto.categoryIds.length) {
           const foundIds = categories.map(c => c.id);
           const missingIds = createProductDto.categoryIds.filter(id => !foundIds.includes(parseInt(id)));
           console.error(`Categories not found or inaccessible for client ${finalClientId}: ${missingIds.join(', ')}`);
           throw new BadRequestException(`One or more categories not found or not accessible: ${missingIds.join(', ')}`);
        }

        product.categories = categories;

    
      const savedProduct = await queryRunner.manager.save(Product, product); 
      
      const shouldTrackProductStock = savedProduct.trackInventory;
      const hasVariantsInDto = createProductDto.variants && createProductDto.variants.length > 0;
      const initialStockValue = createProductDto.initialStock;

      if (shouldTrackProductStock && !hasVariantsInDto && typeof initialStockValue === 'number' && initialStockValue >= 0) {
        console.log(`Recording initial stock (${initialStockValue}) for product ${savedProduct.id}`);
        await this.stockService.recordMovement({
          productId: savedProduct.id,
          quantityChange: initialStockValue,
          movementType: StockMovementType.INITIAL,
          clientId: finalClientId,  
        }, queryRunner);  
      } else if (shouldTrackProductStock && !hasVariantsInDto && initialStockValue === undefined) {
          console.log(`Product ${savedProduct.id} tracking inventory but no initial stock provided. Starting at 0.`);
          await this.stockService.recordMovement({
              productId: savedProduct.id,
              quantityChange: 0, 
              movementType: StockMovementType.INITIAL,
              clientId: finalClientId,
          }, queryRunner);
      } else if (!shouldTrackProductStock) {
         console.log(`Inventory tracking disabled for product ${savedProduct.id}. Skipping initial stock.`);
      } else if (hasVariantsInDto) {
        console.log(`Product ${savedProduct.id} has variants in DTO. Initial stock will be handled at variant level.`);
      }
      
      if (createProductDto.variants && createProductDto.variants.length > 0) {
        await this.createVariantsForProduct(product, createProductDto.variants, queryRunner); // Pass queryRunner
      }

      await queryRunner.commitTransaction();
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

    
    const allAttributeValueIds = variantDtos.flatMap(
        variantDto => variantDto.attributeValues?.map((av: { attributeValueId: string }) => av.attributeValueId) ?? []
    ).filter(id => id); 

    if (allAttributeValueIds.length === 0 && variantDtos.some(dto => dto.attributeValues?.length > 0)) {
        throw new BadRequestException('Attribute value IDs are missing in variant DTOs.');
    }

    let attributeValueMap = new Map<string, AttributeValue>();

   
    if (allAttributeValueIds.length > 0) {
        const uniqueAttributeValueIds = [...new Set(allAttributeValueIds)]; // Ensure uniqueness

        let idsForQuery: (string | number)[];
        try {
            
             idsForQuery = uniqueAttributeValueIds.map(idStr => {
                 const num = parseInt(idStr, 10);
                 if (isNaN(num)) throw new Error(`Invalid attribute value ID format: ${idStr}`);
                 return num;
             });
        } catch (e) {
             throw new BadRequestException(e.message || 'Invalid attribute value ID format.');
        }

       
        const fetchedAttributeValues = await queryRunner.manager.find(AttributeValue, {
            where: {
                id: In(uniqueAttributeValueIds),
                clientId: product.clientId
            },
            relations: { attribute: true } 
        });

       
        if (fetchedAttributeValues.length !== uniqueAttributeValueIds.length) {
            const foundDbIds = fetchedAttributeValues.map(av => av.id); 
            const foundDbIdsAsStrings = foundDbIds.map(idNum => idNum.toString());
            const missingIds = uniqueAttributeValueIds.filter(idStr => !foundDbIdsAsStrings.includes(idStr));
            console.error(`Attribute values not found or inaccessible for client ${product.clientId}: ${missingIds.join(', ')}`);
            throw new BadRequestException(`Attribute values not found or inaccessible: ${missingIds.join(', ')}`);
        }

        // Create a map for easy lookup
        attributeValueMap = new Map(fetchedAttributeValues.map(av => [av.id.toString(), av]));
    }


   
    for (const variantDto of variantDtos) {
        if (!variantDto.sku) { 
            throw new BadRequestException('Variant SKU is required.');
        }

    const variant = queryRunner.manager.create(ProductVariant, {
            sku: variantDto.sku,
            priceAdjustment: variantDto.priceAdjustment ?? 0,
            isActive: variantDto.isActive ?? true,
            clientId: product.clientId, 
            product: { id: product.id } 
        });

        const savedVariant = await queryRunner.manager.save(ProductVariant, variant);
        const initialStockValue = variantDto.initialStock; // Get from DTO
        if (typeof initialStockValue === 'number' && initialStockValue >= 0) {
          console.log(`Recording initial stock (${initialStockValue}) for variant ${savedVariant.id}`);
          // Call StockService within the transaction
          await this.stockService.recordMovement({
              variantId: savedVariant.id, 
              quantityChange: initialStockValue,
              movementType: StockMovementType.INITIAL,
              clientId: product.clientId, 
          });
          console.log(`Initial stock recorded for variant ${savedVariant.id}`);
      } else {
           console.log(`No valid initial stock provided for variant ${savedVariant.id}. Stock level will start at 0 if accessed.`);
           await this.stockService.recordMovement({
               variantId: savedVariant.id,
               quantityChange: 0,
               movementType: StockMovementType.INITIAL,
              clientId: product.clientId,
           });
      }

        const attributeValueEntities: ProductAttributeValue[] = [];
        if (variantDto.attributeValues && variantDto.attributeValues.length > 0) {
            const attributeIdsInVariant = new Set<string>();

            for (const dtoAttributeValue of variantDto.attributeValues) {
                const attributeValueId = dtoAttributeValue.attributeValueId; 
                if (!attributeValueId) {
                    // ... error handling ...
                }
                const currentAttributeValue = attributeValueMap.get(attributeValueId);

                if (!currentAttributeValue) { 
                    throw new InternalServerErrorException(`Could not find fetched attribute value for ID: ${attributeValueId}`);
                }
                const attributeIdAsString = currentAttributeValue.attribute.id.toString();
                 if (attributeIdsInVariant.has(attributeIdAsString)) {
                     throw new BadRequestException(`Variant SKU ${variantDto.sku} cannot have multiple values for the same attribute (Attribute ID: ${currentAttributeValue.attribute.id}).`);
                 }
                  attributeIdsInVariant.add(attributeIdAsString);

                const productAttributeValue = queryRunner.manager.create(ProductAttributeValue, {
                     variant: { id: variant.id },
                     attributeValue: { id: currentAttributeValue.id }, 
                     attribute: { id: currentAttributeValue.attribute.id }, 
                     clientId: product.clientId,
                 });
                attributeValueEntities.push(productAttributeValue);
            }

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
  
   
    const take = end - start + 1;
    const skip = start;
    
    // Build a query builder for more complex queries
    const queryBuilder = this.ProductRepo.createQueryBuilder('product')
      .leftJoinAndSelect('product.categories', 'category')
      .leftJoinAndSelect('product.variants', 'variant')
      .leftJoinAndSelect('variant.attributeValues', 'attrValue')
      .leftJoinAndSelect('attrValue.attributeValue', 'attributeValue')
      .leftJoinAndSelect('attrValue.attribute', 'attribute');
    
    
    if (filters) {
      for (const key in filters) {
        if (
          Object.prototype.hasOwnProperty.call(filters, key) && 
          filters[key] !== undefined &&
          filters[key] !== null
        ) {
         
          if (key === 'categoryId' && filters[key]) {
            queryBuilder.andWhere('category.id = :categoryId', { categoryId: filters[key] });
          }
         
          else if (key === 'attributeValueId' && filters[key]) {
            queryBuilder.andWhere('attributeValue.id = :attributeValueId', { 
              attributeValueId: filters[key] 
            });
          }
          
          else if (this.ProductRepo.metadata.hasColumnWithPropertyPath(key)) {
            queryBuilder.andWhere(`product.${key} = :${key}`, { [key]: filters[key] });
          } else {
            console.warn(`Ignoring invalid filter field: ${key}`);
          }
        }
      }
    }

   
    if (sort && this.ProductRepo.metadata.hasColumnWithPropertyPath(sort)) {
      queryBuilder.orderBy(`product.${sort}`, order.toUpperCase() as 'ASC' | 'DESC');
    } else {
      queryBuilder.orderBy('product.id', 'ASC');
    }
    
    queryBuilder.skip(skip).take(take);
    
    const [data, total] = await queryBuilder.getManyAndCount();

    const productIdsWithDirectStock = data
      .filter(p => p.trackInventory && (!p.variants || p.variants.length === 0)) // Products to track directly
      .map(p => p.id);
      console.log(`>>> Product IDs passed to stock service: ${JSON.stringify(productIdsWithDirectStock)}`);
    let stockMap = new Map<string, number>();
    console.log(`Product IDs with direct stock tracking: ${productIdsWithDirectStock}`);
    console.log(`Stock map before fetching: ${JSON.stringify(stockMap)}`);
    if (productIdsWithDirectStock.length > 0) {
      try {
        stockMap = await this.stockService.getCurrentStockForMultipleItems(productIdsWithDirectStock, 'product');
        console.log(`Stock map after fetching: ${JSON.stringify(stockMap)}`);
      } catch (stockError) {
        console.warn(`Could not fetch batch stock for products: ${stockError.message}`);
      }
    }

   
    const processedData = data.map(product => {
      const productObj = { ...product };
      productObj['categoryIds'] = product.categories.map(category => category.id);
      
      if (product.variants && product.variants.length) {
        const variantPrices = product.variants.map(v => 
          product.basePrice + (v.priceAdjustment || 0)
        );
        productObj['minPrice'] = Math.min(...variantPrices);
        productObj['maxPrice'] = Math.max(...variantPrices);
        productObj['currentStock'] = null;
      } else {
        productObj['minPrice'] = product.basePrice;
        productObj['maxPrice'] = product.basePrice;
        if (product.trackInventory) {
          productObj['currentStock'] = stockMap.get(product.id) ?? 0;
        }else{
          productObj['currentStock'] = null;
        }
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

    let currentStock: number | null = null;
    // Fetch stock only if tracking is enabled AND there are no variants
    if (product.trackInventory && (!product.variants || product.variants.length === 0)) {
      try {
        currentStock = await this.stockService.getCurrentStock(product.id, 'product');
      } catch (error) {
        console.warn(`Could not fetch stock for product ${id}: ${error.message}`);
        // currentStock remains null
      }
    }
    (product as any).currentStock = currentStock;
    
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
      
      const updatedFields: Partial<Product> = {
        name: updateProductDto.name,
        description: updateProductDto.description,
        basePrice: updateProductDto.basePrice,
        isActive: updateProductDto.isActive,
        sku: updateProductDto.sku,
        trackInventory: updateProductDto.trackInventory,
      };

      Object.keys(updatedFields).forEach(key => updatedFields[key] === undefined && delete updatedFields[key]);

      console.log('>>> Updating product with ID:', id, 'with data:', updateProductDto);
      queryRunner.manager.merge(Product, product, updatedFields);

      // Update categories if provided
      if (updateProductDto.categoryIds !== undefined) {
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
      if (error.code === '23505') { // Handle unique constraint errors (SKU)
          throw new ConflictException(`Product update failed: ${error.detail || 'Duplicate value detected.'}`);
      }
      throw new InternalServerErrorException(`Failed to update product: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }
  

  async remove(id: string): Promise<Product> {
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
    }finally{
      console.log(`Product with ID ${id} deleted successfully`);
      return product;
    }
  }
}