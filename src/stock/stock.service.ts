import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException, ConflictException, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository, EntityManager, In, IsNull, FindOptionsWhere,Brackets } from 'typeorm';
import { StockLevel } from './entities/stock-level.entity';
import { StockMovement, } from './entities/stock-movement.entity';
import { Product } from '../products/entities/product.entity'; 
import { ProductVariant } from '../products/entities/product-variant.entity'; 
import { ClsService } from 'nestjs-cls';
import { Role } from '../common/enums/role.enum';
import { StockMovementType } from '../common/enums/stock-movement.enum';
import { GetStockHistoryQueryDto } from './dto/get-stock-history.dto';
import { UpdateStockMovementDto } from './dto/update-stock-movement.dto';



export interface RecordMovementData {
  productId?: string;
  variantId?: string;
  quantityChange: number; 
  movementType: StockMovementType;
  reason?: string;
  sourceDocumentId?: string;
  sourceDocumentType?: string;
  userId?: string; 
  clientId?: string; 
  movementDate?: Date; 
}

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    @InjectRepository(StockLevel)
    private readonly stockLevelRepository: Repository<StockLevel>,
    @InjectRepository(StockMovement)
    private readonly stockMovementRepository: Repository<StockMovement>,

    private readonly dataSource: DataSource,
    private readonly cls: ClsService,
  ) {}

  /**
   * Records a stock movement and updates the corresponding stock level within a transaction.
   * @param data - The details of the stock movement.
   * @param externalQueryRunner - Optional external query runner for transaction management.
   * @returns The created StockMovement record.
   * @throws BadRequestException if input data is invalid.
   * @throws NotFoundException if the product/variant doesn't exist for the client.
   * @throws ConflictException if trying to decrease stock below zero.
   * @throws InternalServerErrorException for database or context errors.
   */
  async recordMovement(data: RecordMovementData, externalQueryRunner?: QueryRunner): Promise<StockMovement> {
    
    const shouldManageTransaction = !externalQueryRunner;
    let queryRunner: QueryRunner | undefined;
    let manager: EntityManager;

    if (shouldManageTransaction) {
      queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction('SERIALIZABLE');
      manager = queryRunner.manager; 
      this.logger.verbose('recordMovement started its own transaction.');
  } else {
      manager = externalQueryRunner.manager; 
      this.logger.verbose('recordMovement operating within an external transaction.');
  }

    
    const clsClientId = this.cls.get('clientId');
    const userId = data.userId ?? this.cls.get('userId'); 
    const userRoles = this.cls.get('userRoles') as Role[] | undefined; 
    const isSuperAdmin = userRoles?.includes(Role.SuperAdmin);

    let targetClientId: string | undefined;

    if( isSuperAdmin) {
      if (!data.clientId) {
        if (shouldManageTransaction && queryRunner) {
            await queryRunner.rollbackTransaction();
            await queryRunner.release();
        }
        throw new BadRequestException('SuperAdmin must provide clientId when recording a stock movement.');
      }
      targetClientId = data.clientId;
    } else {
      targetClientId = clsClientId;
      if (!targetClientId) {
        if (shouldManageTransaction && queryRunner){
          await queryRunner.rollbackTransaction();
          await queryRunner.release();
        }
        throw new InternalServerErrorException('Client context (clientId) not found.');
      }
      if (data.clientId && data.clientId !== targetClientId) {
        this.logger.warn(`Non-SuperAdmin attempted to record movement for clientId ${data.clientId} but CLS clientId ${targetClientId} will be used.`);
      }
    }



    if (!targetClientId) {
      if (shouldManageTransaction && queryRunner) await queryRunner.rollbackTransaction();
      if (shouldManageTransaction && queryRunner) await queryRunner.release();
      throw new InternalServerErrorException('Client context (clientId) not found.');
    }
    if (!data.productId && !data.variantId) {
      if (shouldManageTransaction && queryRunner) await queryRunner.rollbackTransaction();
      if (shouldManageTransaction && queryRunner) await queryRunner.release();
      throw new BadRequestException('Either productId or variantId must be provided.');
    }
    if (data.productId && data.variantId) {
      if (shouldManageTransaction && queryRunner) await queryRunner.rollbackTransaction();
      if (shouldManageTransaction && queryRunner) await queryRunner.release();
      throw new BadRequestException('Cannot provide both productId and variantId.');
    }
    if (data.quantityChange === 0) {
      if (shouldManageTransaction && queryRunner) await queryRunner.rollbackTransaction();
      if (shouldManageTransaction && queryRunner) await queryRunner.release();
      throw new BadRequestException('Quantity change cannot be zero.');
    }
    

    try {
      const productWhere: any = { id: data.productId};
      if (!userRoles?.includes(Role.SuperAdmin)) {
        productWhere.clientId = targetClientId; 
    }
      if (data.productId) {
        const productExists = await manager.existsBy(Product, { id: data.productId, clientId: targetClientId });
        console.log(`Checking product existence for ID ${data.productId}: ${productExists}`);
        console.log(`Client ID for product check: ${targetClientId}`);
        console.log(`User roles for product check: ${userRoles}`);
        if (!productExists) throw new NotFoundException(`Product with ID ${data.productId} not found for this client.`);
      } else if (data.variantId) {
        const variantExists = await manager.existsBy(ProductVariant, { id: data.variantId, clientId: targetClientId });
        if (!variantExists) throw new NotFoundException(`Variant with ID ${data.variantId} not found for this client.`);
      }

      const stockLevelWhere = {
        productId: data.productId,
        variantId: data.variantId,
        clientId: targetClientId,
      };


      let stockLevel = await manager.findOne(StockLevel, {
        where: stockLevelWhere,
        lock: { mode: 'pessimistic_write' } 
      });


      if (!stockLevel) {
        const createData = {
          productId: data.productId,
          variantId: data.variantId, 
          clientId: targetClientId,
          quantity: 0,
        };
        stockLevel = manager.create(StockLevel, createData);
       
        stockLevel = await manager.save(StockLevel, stockLevel);
       
        stockLevel = await manager.findOneOrFail(StockLevel, {
            where: { id: stockLevel.id },
            lock: { mode: 'pessimistic_write' }
        });

        
      }

      
      const newQuantity = stockLevel.quantity + data.quantityChange;
      if (newQuantity < 0) {
        throw new ConflictException(`Insufficient stock for ${data.productId ? 'product ' + data.productId : 'variant ' + data.variantId}. Current: ${stockLevel.quantity}, Required Change: ${data.quantityChange}`);
      }

      
      stockLevel.quantity = newQuantity;
      await manager.save(StockLevel, stockLevel); 

      
      const movement = manager.create(StockMovement, {
        productId: data.productId,
        variantId: data.variantId,
        quantityChange: data.quantityChange,
        movementType: data.movementType,
        reason: data.reason,
        sourceDocumentId: data.sourceDocumentId,
        sourceDocumentType: data.sourceDocumentType,
        userId: userId, 
        clientId: targetClientId, 
        movementDate: data.movementDate ?? new Date(), 
       
      });
      const savedMovement = await manager.save(StockMovement, movement);

     
      if (shouldManageTransaction && queryRunner) {
        await queryRunner.commitTransaction();
    }
      return savedMovement;

    } catch (error) {
      if (shouldManageTransaction && queryRunner) {
        await queryRunner.rollbackTransaction();
      }
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException(`Failed to record stock movement: ${error.message}`);
    } finally {
      if (shouldManageTransaction && queryRunner) {
        await queryRunner.release();
    }
    }
  }

  /**
   * Gets the current stock quantity for a specific product or variant.
   * @param itemId - The ID of the product or variant.
   * @param itemType - Specifies whether the ID belongs to a 'product' or 'variant'.
   * @returns The current stock quantity (defaults to 0 if no record exists).
   * @throws InternalServerErrorException if client context is missing.
   */
  async getCurrentStock(itemId: string, itemType: 'product' | 'variant'): Promise<number> {
    const clientId = this.cls.get('clientId');
    const userRoles = this.cls.get('userRoles') as Role[] | undefined;
    const isSuperAdmin = userRoles?.includes(Role.SuperAdmin);

    
    const where: FindOptionsWhere<StockLevel> = {}; 

    if (!isSuperAdmin) {
      if (!clientId) {
        throw new InternalServerErrorException('Client context (clientId) not found.');
      }
      where.clientId = clientId; 
    }
    

    if (itemType === 'product') {
      where.productId = itemId;
      where.variantId = IsNull(); 
    } else {
      where.variantId = itemId;
    }
    


    const stockLevel = await this.stockLevelRepository.findOne({
      where: where,
      select: ['quantity'],
     });

    return stockLevel?.quantity ?? 0;
  }

  async getCurrentStockForMultipleItems(
    itemIds: string[],
    itemType: 'product' | 'variant'
  ): Promise<Map<string, number>> {
    const clientId = this.cls.get('clientId');
    const userRoles = this.cls.get('userRoles') as Role[] | undefined;
    const isSuperAdmin = userRoles?.includes(Role.SuperAdmin);


    if (!itemIds || itemIds.length === 0) {
      return new Map();
    }

    
    const whereCondition: FindOptionsWhere<StockLevel> = {}; 

    if (!isSuperAdmin) {
       if (!clientId) {
         throw new InternalServerErrorException('Client context (clientId) not found.');
       }
       whereCondition.clientId = clientId; 
    }
    

    if (itemType === 'product') {
      whereCondition.productId = In(itemIds);
      whereCondition.variantId = IsNull(); 
    } else {
      whereCondition.variantId = In(itemIds);
    }
    


    const stockLevels = await this.stockLevelRepository.find({
      where: whereCondition,
      select: itemType === 'product' ? ['productId', 'quantity'] : ['variantId', 'quantity'],
    });


    const stockMap = new Map<string, number>(itemIds.map(id => [id, 0]));

    
    stockLevels.forEach(sl => {
      const id = itemType === 'product' ? sl.productId : sl.variantId;
      if (id) {
        stockMap.set(id, sl.quantity);
      }
    });


    return stockMap;
  }
 
  async getStockHistory(
    queryDto: GetStockHistoryQueryDto,
  ): Promise<{ data: StockMovement[]; total: number; page: number; limit: number }> {
    const {
      productId,
      variantId,
      movementType,
      dateFrom,
      dateTo,
      page = 1,
      limit = 10,
      sortBy = 'movementDate',
      sortOrder = 'DESC',
    } = queryDto;

    const clientId = this.cls.get('clientId');
    const userRoles = this.cls.get('userRoles') as Role[] | undefined;
    const isSuperAdmin = userRoles?.includes(Role.SuperAdmin);


    const queryBuilder = this.stockMovementRepository.createQueryBuilder('sm');

    
    if (!isSuperAdmin) {
      if (!clientId) {
        throw new InternalServerErrorException('Client context (clientId) not found.');
      }
      queryBuilder.where('sm.clientId = :clientId', { clientId });
    }

    if (productId) {
      queryBuilder.andWhere('sm.productId = :productId', { productId });
    } else if (variantId) {
      queryBuilder.andWhere('sm.variantId = :variantId', { variantId });
    } else {
      // Optional: Require either productId or variantId if not SuperAdmin,
      // or allow SuperAdmin to see all if neither is provided.
    }

    if (movementType) {
      queryBuilder.andWhere('sm.movementType = :movementType', { movementType });
    }

    if (dateFrom) {
      queryBuilder.andWhere('sm.movementDate >= :dateFrom', { dateFrom: new Date(dateFrom) });
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      queryBuilder.andWhere('sm.movementDate <= :dateTo', { dateTo: endDate });
    }

  
    queryBuilder.leftJoinAndSelect('sm.user', 'user');
   
    const validSortFields = ['movementDate', 'movementType', 'quantityChange']; 
    if (validSortFields.includes(sortBy)) {
        queryBuilder.orderBy(`sm.${sortBy}`, sortOrder);
    } else {
        queryBuilder.orderBy('sm.movementDate', 'DESC'); 
    }
  
    queryBuilder.skip((page - 1) * limit).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();
    

    return { data, total, page, limit };
  }
  
  async getStockMovementById(movementId: string): Promise<StockMovement> {
    const clientId = this.cls.get('clientId');
    const userRoles = this.cls.get('userRoles') as Role[] | undefined;
    const isSuperAdmin = userRoles?.includes(Role.SuperAdmin);

    const queryBuilder = this.stockMovementRepository.createQueryBuilder('sm')
      .where('sm.id = :movementId', { movementId });

    if (!isSuperAdmin) {
      if (!clientId) {
        throw new InternalServerErrorException('Client context (clientId) not found.');
      }
      queryBuilder.andWhere('sm.clientId = :clientId', { clientId });
    }

    const movement = await queryBuilder
      .leftJoinAndSelect('sm.user', 'user')
      .getOne();

    if (!movement) {
      throw new NotFoundException(`Stock movement with ID ${movementId} not found.`);
    }

    return movement;
  }

  async updateStockMovement(
    movementId: string,
    correctionData: UpdateStockMovementDto,
    externalQueryRunner?: QueryRunner,
  ): Promise<{ originalMovement: StockMovement, reversalMovement: StockMovement, correctedMovement: StockMovement }> {
    const shouldManageTransaction = !externalQueryRunner;
    let queryRunner: QueryRunner | undefined = externalQueryRunner;

    if (shouldManageTransaction) {
      queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction('SERIALIZABLE');
      this.logger.verbose(`correctStockMovement (${movementId}) started its own transaction.`);
    } else {
      this.logger.verbose(`correctStockMovement (${movementId}) operating within an external transaction.`);
    }

    try {
      const manager = queryRunner!.manager;
      const originalMovement = await manager.findOne(StockMovement, { where: { id: movementId } });

      if (!originalMovement) {
        throw new NotFoundException(`Stock movement with ID ${movementId} not found.`);
      }
      
      // Permission check
      const clientId = this.cls.get('clientId');
      const userRoles = this.cls.get('userRoles') as Role[] | undefined;
      if (!userRoles?.includes(Role.SuperAdmin) && originalMovement.clientId !== clientId) {
          throw new ForbiddenException('You do not have permission to correct this stock movement.');
      }

      // 1. Reverse the original movement
      const reversalMovementData: RecordMovementData = {
        productId: originalMovement.productId,
        variantId: originalMovement.variantId,
        quantityChange: -originalMovement.quantityChange,
        movementType: originalMovement.movementType,
        reason: `Reversal for correction of movement ${originalMovement.id}.`,
        sourceDocumentId: originalMovement.id,
        sourceDocumentType: 'STOCK_MOVEMENT_CORRECTION',
      };
      const reversalMovement = await this.recordMovement(reversalMovementData, queryRunner);

      // 2. Apply the new corrected movement
      const correctedMovementData: RecordMovementData = {
        productId: originalMovement.productId,
        variantId: originalMovement.variantId,
        quantityChange: correctionData.newQuantityChange,
        movementType: correctionData.newMovementType || originalMovement.movementType, // Use new or original type
        reason: correctionData.newReason || `Correction applied for movement ${originalMovement.id}.`,
        sourceDocumentId: correctionData.newSourceDocumentId || originalMovement.id,
        sourceDocumentType: correctionData.newSourceDocumentType || 'STOCK_MOVEMENT_CORRECTION',
      };
      const correctedMovement = await this.recordMovement(correctedMovementData, queryRunner);

      
      
      await manager.save(StockMovement, originalMovement);

      if (shouldManageTransaction) {
        await queryRunner!.commitTransaction();
      }
      return { originalMovement, reversalMovement, correctedMovement };

    } catch (error) {
      if (shouldManageTransaction && queryRunner && queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      this.logger.error(`Failed to correct stock movement ${movementId}: ${error.message}`, error.stack);
      throw error;
    } finally {
      if (shouldManageTransaction && queryRunner) {
        await queryRunner.release();
      }
    }
  }
  
}
