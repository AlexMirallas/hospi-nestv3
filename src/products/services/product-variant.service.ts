import { Injectable, NotFoundException,InternalServerErrorException,ForbiddenException, BadRequestException, ConflictException } from "@nestjs/common";
import { ProductVariant } from "../entities/product-variant.entity";
import { ProductVariantRepository } from "../repositories/product-variant.repository";
import { ProductRepository } from "../repositories/product.repository";
import { Product } from "../entities/product.entity";
import { AttributeValue } from "../../attributes/entities/attribute-value.entity"
import { ProductAttributeValue } from "../entities/product-attribute-value.entity";
import { CreateProductVariantDto } from "../dto/create/create-product-variant.dto";
import { UpdateProductVariantDto } from "../dto/update/update-product-variant.dto";
import { SimpleRestParams } from "../../common/pipes/parse-simple-rest.pipe";
import { ClsService } from "nestjs-cls";
import { DataSource,In, QueryRunner } from "typeorm";
import { Role } from "../../common/enums/role.enum";
import { StockService } from "src/stock/stock.service";
import { StockMovementType } from "src/common/enums/stock-movement.enum";
import { StockMovement } from "src/stock/entities/stock-movement.entity"; // Import
import { StockLevel } from "src/stock/entities/stock-level.entity"; // Import
import { ProductImage } from "../entities/image.entity"; // Import
import * as fs from 'fs-extra'; // Import fs-extra for robust file operations
import * as path from 'path'; // Import path



@Injectable()
export class ProductVariantService {
    constructor(
        private readonly VariantRepo: ProductVariantRepository,
        private readonly ProductRepo: ProductRepository,
        private readonly stockService: StockService,
        private readonly cls: ClsService,
        private readonly dataSource: DataSource,
      ) {}


      async findOne(id: string): Promise<ProductVariant | null> {
        const variant = await this.VariantRepo.findOne({
           where: { id },
           relations: {
            product: true,
            attributeValues: {
              attributeValue: true,
              attribute: true
            },
          },
      });
      let currentStock: number | null = null;
    try {
      currentStock = await this.stockService.getCurrentStock(id, 'variant');
    } catch (stockError) {
      console.warn(`Could not fetch stock for variant ${id}: ${stockError.message}`);
    }
    (variant as any).currentStock = currentStock;
    return variant;
  }
    
    

      /**
       * Find all variants for a given product ID
       */

      async findVariantsByProductId(productId: string): Promise<ProductVariant[]> {
        const productExists = await this.ProductRepo.findOneBy({ id: productId });
        if (!productExists) {
          throw new NotFoundException(`Product with ID ${productId} not found.`);
        }

    
        const variants = await this.VariantRepo.find({
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
            sku: 'ASC', 
          },
        });
        const variantIds = variants.map(v => v.id);
    let stockMap = new Map<string, number>();
    if (variantIds.length > 0) {
      try {
        stockMap = await this.stockService.getCurrentStockForMultipleItems(variantIds, 'variant');
      } catch (stockError) {
        console.warn(`Could not fetch batch stock for variants of product ${productId}: ${stockError.message}`);
      }
    }
    variants.forEach(variant => {
      (variant as any).currentStock = stockMap.get(variant.id) ?? 0;
    });

    return variants;
  }

      async findPaginatedVariants(
        params: SimpleRestParams,
      ): Promise<{ data: ProductVariant[]; total: number }> {
        const { start = 0, end = 9, sort = "sku", order = 'ASC', filters = {} } = params;

        const take = end - start + 1;
        const skip = start;

    
        const queryBuilder = this.VariantRepo.createQueryBuilder('variant')
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
                        queryBuilder.andWhere('product.id = :productId', { productId: filterValue });
                        whereParams.productId = filterValue; 
                    }

                    else if (key === 'clientId' && this.cls.get('userRoles')?.includes(Role.SuperAdmin)) {
                      queryBuilder.andWhere('variant.clientId = :filterClientId', { filterClientId: filterValue });
                  }

                    else if (key === 'sku') {
                         queryBuilder.andWhere('variant.sku ILIKE :sku', { sku: `%${filterValue}%` });
                    }

                    else if (key === 'id' && Array.isArray(filterValue) && filterValue.length > 0) {
                         queryBuilder.andWhere('variant.id IN (:...variantIds)', { variantIds: filterValue });
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
        if (this.VariantRepo.metadata.hasColumnWithPropertyPath(sort)) {
             queryBuilder.orderBy(`variant.${sort}`, order.toUpperCase() as 'ASC' | 'DESC');
        } else {
             queryBuilder.orderBy('variant.sku', 'ASC'); // Default sort
        }


        queryBuilder.skip(skip).take(take);
     
        const [data, total] = await queryBuilder.getManyAndCount();

        const variantIds = data.map(v => v.id);
        let stockMap = new Map<string, number>();
        if (variantIds.length > 0) {
          try {
            stockMap = await this.stockService.getCurrentStockForMultipleItems(variantIds, 'variant');
          } catch (stockError) {
            console.warn(`Could not fetch batch stock for paginated variants: ${stockError.message}`);
          }
        }
        data.forEach(variant => {
          (variant as any).currentStock = stockMap.get(variant.id) ?? 0;
        });
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
        await queryRunner.startTransaction('SERIALIZABLE');

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
            isActive: createVariantDto.isActive ?? true,
            product: { id: product.id },
            clientId: finalClientId,
          });

          const savedVariant = await queryRunner.manager.save(ProductVariant, newVariant);


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

          const createdVariant = await this.VariantRepo.findOne({
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

          if (!isSuperAdmin && variant.clientId !== currentUserClientId) {
            console.warn(`Admin ${currentUserClientId} attempting to update variant ${variant.id} owned by client ${variant.clientId}.`);
            throw new ForbiddenException(`You do not have permission to update this variant `);
          }

      
          if (updateDto.sku !== undefined) variant.sku = updateDto.sku;
          if (updateDto.priceAdjustment !== undefined) variant.priceAdjustment = updateDto.priceAdjustment;
          if (updateDto.isActive !== undefined) variant.isActive = updateDto.isActive;


         
          await queryRunner.manager.save(ProductVariant, variant);

      
          if (updateDto.attributeValues && updateDto.attributeValues.length > 0) {
            console.log('>>> Validating attribute values:', updateDto.attributeValues);

           
            const newAttributeValueIds = updateDto.attributeValues.map(av => av.attributeValueId);
            console.log('>>> New attribute value IDs:', newAttributeValueIds);


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
            
            const newValueMap = new Map(newAttributeValues.map(v => [v.id, v]));

            for (const dtoValue of updateDto.attributeValues) {
                const newValue = newValueMap.get(dtoValue.attributeValueId);
                if (newValue?.attribute.id !== dtoValue.attributeId) {
                    throw new BadRequestException(`AttributeValue ID ${dtoValue.attributeValueId} does not belong to Attribute ID ${dtoValue.attributeId}.`);
                }
            }

            // delete all old ProductAttributeValue links
            if (variant.attributeValues && variant.attributeValues.length > 0) {
                const oldAttributeValueIds = variant.attributeValues.map(av => av.id);
                if (oldAttributeValueIds.length > 0) {
                    await queryRunner.manager.delete(ProductAttributeValue, oldAttributeValueIds);
                }
            }

            //  create completely new ProductAttributeValue entities
            const newLinks: ProductAttributeValue[] = [];
            for (const dtoValue of updateDto.attributeValues) {
                const correspondingValue = newValueMap.get(dtoValue.attributeValueId);
                console.log('>>> Creating new link for attribute value:', correspondingValue);

                if (!correspondingValue) {
                    throw new InternalServerErrorException(`Failed to find validated AttributeValue ${dtoValue.attributeValueId}`);
                }

                // create new instance without specifying existing IDs
                const newLink = queryRunner.manager.create(ProductAttributeValue, {
                  variant: { id: variant.id }, 
                  attributeValue: correspondingValue, 
                  attribute: correspondingValue.attribute, 
                });

                newLinks.push(newLink);
            }

            if (newLinks.length > 0) {
                await queryRunner.manager.save(ProductAttributeValue, newLinks);
            }
          }

          await queryRunner.commitTransaction();

          const updatedVariant = await this.VariantRepo.findOne({
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
          console.error("Error updating variant:", error);
          if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ForbiddenException) {
              throw error;
          }
          if (error.code === '23505') { // Handle unique constraint errors)
              throw new ConflictException(`Variant update failed: ${error.detail || 'Duplicate value detected.'}`);
          }
          throw error;
        } finally {
          await queryRunner.release();
        }
      }

      /**
       * Delete a product variant by ID
       */
      async removeVariant(id: string): Promise<ProductVariant> {
        const currentUserRoles = this.cls.get('userRoles') as Role[] | undefined;
        const currentUserClientId = this.cls.get('clientId') as string | undefined;
        if (!currentUserRoles || !currentUserClientId && !currentUserRoles?.includes(Role.SuperAdmin)) { // Allow SuperAdmin if CLS is not set for them
          throw new InternalServerErrorException('User context not found.');
        }
        const isSuperAdmin = currentUserRoles.includes(Role.SuperAdmin);

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction('SERIALIZABLE');
      

        try {
          const variant = await queryRunner.manager.findOne(ProductVariant, {
            where: { id },
            relations: { product: true } // Need product for clientId if variant.clientId is not directly available or for context
          });

          if (!variant) {
            throw new NotFoundException(`Product variant with ID ${id} not found`);
          }

          const targetClientId = variant.clientId; // Assuming variant has a clientId

          if (!isSuperAdmin && targetClientId !== currentUserClientId) {
            throw new ForbiddenException(`You do not have permission to delete this variant.`);
          }

          await queryRunner.manager.delete(ProductAttributeValue, { variant: { id: variant.id } });

          await queryRunner.manager.delete(StockMovement, { variantId: variant.id, clientId: targetClientId });

          await queryRunner.manager.delete(StockLevel, { variantId: variant.id, clientId: targetClientId });

          const images = await queryRunner.manager.find(ProductImage, { where: { variantId: variant.id, clientId: targetClientId } });
          if (images.length > 0) {
            for (const image of images) {
              try {
                const filePath = path.join(process.cwd(), image.path);
                if (await fs.pathExists(filePath)) {
                  await fs.unlink(filePath);
                } else {
                }
              } catch (fileError) {
                throw new InternalServerErrorException(`Failed to delete image file ${image.path}: ${fileError.message}`);
              }
            }
            await queryRunner.manager.remove(images); 
          }


          await queryRunner.manager.remove(ProductVariant, variant); 

          await queryRunner.commitTransaction();
          return variant; 
        } catch (error) {
          await queryRunner.rollbackTransaction();
          if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof InternalServerErrorException) {
            throw error;
          }
          throw new InternalServerErrorException(`Failed to remove product variant ${id}: ${error.message}`);
        } finally {
          await queryRunner.release();

        }
    }
}