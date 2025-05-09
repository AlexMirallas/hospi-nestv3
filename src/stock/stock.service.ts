import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException, ConflictException, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository, EntityManager, In, IsNull, FindOptionsWhere } from 'typeorm';
import { StockLevel } from './entities/stock-level.entity';
import { StockMovement, } from './entities/stock-movement.entity';
import { Product } from '../products/entities/product.entity'; 
import { ProductVariant } from '../products/entities/product-variant.entity'; 
import { ClsService } from 'nestjs-cls';
import { Role } from '../common/enums/role.enum';
import { StockMovementType } from '../common/enums/stock-movement.enum';


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

    
    const clientId = data.clientId ?? this.cls.get('clientId');
    const userId = data.userId ?? this.cls.get('userId'); 
    const userRoles = this.cls.get('userRoles') as Role[] | undefined; 

   
    if (!clientId) {
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
    // --- End Input Validation ---

    try {
      const productWhere: any = { id: data.productId};
      if (!userRoles?.includes(Role.SuperAdmin)) {
        productWhere.clientId = clientId; 
    }
      if (data.productId) {
        const productExists = await manager.existsBy(Product, { id: data.productId, clientId });
        if (!productExists) throw new NotFoundException(`Product with ID ${data.productId} not found for this client.`);
      } else if (data.variantId) {
        const variantExists = await manager.existsBy(ProductVariant, { id: data.variantId, clientId });
        if (!variantExists) throw new NotFoundException(`Variant with ID ${data.variantId} not found for this client.`);
      }

      const stockLevelWhere = {
        productId: data.productId,
        variantId: data.variantId,
        clientId: clientId,
      };

      console.log(`Finding stock level for ${data.productId ? 'product ' + data.productId : 'variant ' + data.variantId} with clientId ${clientId}`);

      let stockLevel = await manager.findOne(StockLevel, {
        where: stockLevelWhere,
        lock: { mode: 'pessimistic_write' } 
      });


      if (!stockLevel) {
        this.logger.log(`Creating initial stock level for ${data.productId ? 'product ' + data.productId : 'variant ' + data.variantId} stockLevel: ${stockLevel}`);
        const createData = {
          productId: data.productId,
          variantId: data.variantId, 
          clientId: clientId,
          quantity: 0,
        };
        this.logger.debug(`Data for manager.create(StockLevel): ${JSON.stringify(createData)}`);
        stockLevel = manager.create(StockLevel, createData);
        this.logger.debug(`Created stockLevel entity: ${JSON.stringify(stockLevel)}`);
       
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

      this.logger.log(`Initial stock level created for ${data.productId ? 'product ' + data.productId : 'variant ' + data.variantId}: ${stockLevel.quantity}`);

      
      const movement = manager.create(StockMovement, {
        productId: data.productId,
        variantId: data.variantId,
        quantityChange: data.quantityChange,
        movementType: data.movementType,
        reason: data.reason,
        sourceDocumentId: data.sourceDocumentId,
        sourceDocumentType: data.sourceDocumentType,
        userId: userId, 
        clientId: clientId, 
        movementDate: data.movementDate ?? new Date(), 
       
      });
      const savedMovement = await manager.save(StockMovement, movement);

     
      if (shouldManageTransaction && queryRunner) {
        await queryRunner.commitTransaction();
        this.logger.verbose('recordMovement committed its own transaction.');
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

    // --- Conditionally build the where clause ---
    const where: FindOptionsWhere<StockLevel> = {}; // Use TypeORM's type

    if (!isSuperAdmin) {
      if (!clientId) {
        this.logger.error('[GetCurrentStock] Client context (clientId) not found for non-SuperAdmin.');
        throw new InternalServerErrorException('Client context (clientId) not found.');
      }
      where.clientId = clientId; // Apply clientId filter for non-SuperAdmins
    }
    // SuperAdmin does not filter by clientId by default

    if (itemType === 'product') {
      where.productId = itemId;
      where.variantId = IsNull(); // Or null, based on previous findings
    } else {
      where.variantId = itemId;
    }
    // --- End where clause ---

    this.logger.debug(`[GetCurrentStock] Executing findOne with where: ${JSON.stringify(where)} (SuperAdmin: ${isSuperAdmin})`);

    const stockLevel = await this.stockLevelRepository.findOne({
      where: where,
      select: ['quantity'],
     });

    this.logger.debug(`[GetCurrentStock] Found stock level for item ${itemId} (${itemType}): ${JSON.stringify(stockLevel)}`);
    return stockLevel?.quantity ?? 0;
  }

  async getCurrentStockForMultipleItems(
    itemIds: string[],
    itemType: 'product' | 'variant'
  ): Promise<Map<string, number>> {
    const clientId = this.cls.get('clientId');
    const userRoles = this.cls.get('userRoles') as Role[] | undefined;
    const isSuperAdmin = userRoles?.includes(Role.SuperAdmin);

    this.logger.debug(`[MultiStock] Received itemIds: ${JSON.stringify(itemIds)}, itemType: ${itemType}, SuperAdmin: ${isSuperAdmin}`);

    if (!itemIds || itemIds.length === 0) {
       this.logger.debug('[MultiStock] No itemIds provided, returning empty map.');
      return new Map();
    }

    // --- Conditionally build the where clause ---
    const whereCondition: FindOptionsWhere<StockLevel> = {}; // Use TypeORM's type

    if (!isSuperAdmin) {
       if (!clientId) {
         this.logger.error('[MultiStock] Client context (clientId) not found for non-SuperAdmin.');
         // Depending on requirements, you might throw or return empty map
         throw new InternalServerErrorException('Client context (clientId) not found.');
       }
       whereCondition.clientId = clientId; // Apply clientId filter for non-SuperAdmins
    }
     // SuperAdmin does not filter by clientId by default

    if (itemType === 'product') {
      whereCondition.productId = In(itemIds);
      whereCondition.variantId = IsNull(); 
    } else {
      whereCondition.variantId = In(itemIds);
    }
    // --- End where clause ---

    this.logger.debug(`[MultiStock] Executing find with where: ${JSON.stringify(whereCondition)}`);

    const stockLevels = await this.stockLevelRepository.find({
      where: whereCondition,
      select: itemType === 'product' ? ['productId', 'quantity'] : ['variantId', 'quantity'],
    });

    this.logger.debug(`[MultiStock] Found stockLevels from DB: ${JSON.stringify(stockLevels)}`);

    // Initialize map with all requested IDs having 0 stock
    const stockMap = new Map<string, number>(itemIds.map(id => [id, 0]));

    // Update map with actual quantities found
    stockLevels.forEach(sl => {
      const id = itemType === 'product' ? sl.productId : sl.variantId;
      if (id) {
        stockMap.set(id, sl.quantity);
      }
    });

     this.logger.debug(`[MultiStock] Returning stockMap: ${JSON.stringify(Array.from(stockMap.entries()))}`);

    return stockMap;
  }
 
  // async getStockHistory()
  // async adjustStock()
}
