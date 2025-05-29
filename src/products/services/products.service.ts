import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, ForbiddenException,ConflictException } from '@nestjs/common';
import { InjectRepository, } from '@nestjs/typeorm';
import { Repository, In, DataSource, QueryRunner, IsNull } from 'typeorm';
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
import { StockMovement } from 'src/stock/entities/stock-movement.entity';
import { StockLevel } from 'src/stock/entities/stock-level.entity';
import { ProductImage } from '../entities/image.entity';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Console } from 'console';


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

    if (product.variants && product.variants.length > 0) {
      const variantIds = product.variants.map(variant => variant.id);
      if (variantIds.length > 0) {
        try {
          const variantStockMap = await this.stockService.getCurrentStockForMultipleItems(variantIds, 'variant');
          product.variants = product.variants.map(variant => {
            const variantWithStock = { ...variant };
            (variantWithStock as any).currentStock = variantStockMap.get(variant.id) ?? 0;
            return variantWithStock;
          });
        } catch (error) {
          console.warn(`Could not fetch batch stock for variants of product ${id}: ${error.message}`);
          // Optionally set currentStock to null or 0 for all variants if fetching fails
          product.variants = product.variants.map(variant => {
            const variantWithStock = { ...variant };
            (variantWithStock as any).currentStock = null; // Or 0, depending on desired behavior
            return variantWithStock;
          });
        }
      }
    }
    
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
    if (!currentUserRoles || !currentUserClientId && !currentUserRoles?.includes(Role.SuperAdmin)) {
      throw new InternalServerErrorException('User context not found.');
    }
    const isSuperAdmin = currentUserRoles.includes(Role.SuperAdmin);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      const product = await queryRunner.manager.findOne(Product, {
        where: { id },
        relations: { variants: true }, 
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }

      const targetClientId = product.clientId;

      if (!isSuperAdmin && targetClientId !== currentUserClientId) {
        throw new ForbiddenException(`You do not have permission to delete this product.`);
      }

      if (product.variants && product.variants.length > 0) {
        for (const variant of product.variants) {
          await queryRunner.manager.delete(ProductAttributeValue, { variant: { id: variant.id } });
          await queryRunner.manager.delete(StockMovement, { variantId: variant.id, clientId: targetClientId });
          await queryRunner.manager.delete(StockLevel, { variantId: variant.id, clientId: targetClientId });


          const variantImages = await queryRunner.manager.find(ProductImage, { where: { variantId: variant.id, clientId: targetClientId } });
          if (variantImages.length > 0) {
            for (const image of variantImages) {
              try {
                const filePath = path.join(process.cwd(), image.path);
                if (await fs.pathExists(filePath)) {
                  await fs.unlink(filePath);
                } else {
                  console.warn(`Physical image file not found at ${filePath} for image ID ${image.id}`);
                }
              } catch (fileError) {
                throw new InternalServerErrorException(`Error deleting physical image file ${image.path} for variant ${variant.id}: ${fileError.message}`);
              }
            }
            await queryRunner.manager.remove(variantImages);
          }
        }
        await queryRunner.manager.remove(ProductVariant, product.variants);
      }

      await queryRunner.manager.delete(StockMovement, { productId: product.id, variantId: null, clientId: targetClientId }); 
      await queryRunner.manager.delete(StockLevel, { productId: product.id, variantId: IsNull(), clientId: targetClientId });


      const productImages = await queryRunner.manager.find(ProductImage, { where: { productId: product.id, variantId: IsNull(), clientId: targetClientId } });
      if (productImages.length > 0) {
        for (const image of productImages) {
           try {
            const filePath = path.join(process.cwd(), image.path);
            if (await fs.pathExists(filePath)) {
              await fs.unlink(filePath);
            } else {
              console.warn(`Physical image file not found at ${filePath} for image ID ${image.id}`);
            }
          } catch (fileError) {
            throw new InternalServerErrorException(`Error deleting physical image file ${image.path} for product ${id}: ${fileError.message}`);
          }
        }
        await queryRunner.manager.remove(productImages);
      }

      await queryRunner.manager.remove(Product, product);
      await queryRunner.commitTransaction();
      return product;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException(`Failed to remove product ${id}: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }
}