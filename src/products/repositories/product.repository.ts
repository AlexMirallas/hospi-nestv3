import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
    Repository,
    FindOneOptions,
    FindOptionsWhere,
    SelectQueryBuilder,
    ObjectLiteral,
    FindManyOptions,
    DeepPartial,
    SaveOptions,
    RemoveOptions,
    DeleteResult,
} from 'typeorm';
import { ClsService } from 'nestjs-cls';
import { Product } from '../entities/product.entity';
import { Role } from '../../common/enums/role.enum'; 

@Injectable()
export class ProductRepository {
    constructor(
        @InjectRepository(Product)
        private readonly repository: Repository<Product>, 
        private readonly cls: ClsService,
    ) {}

  
    private getTenantCondition(alias?: string): { condition: string; parameters: ObjectLiteral } | null {
        const clientId = this.cls.get('clientId');
        const userRoles = this.cls.get('userRoles') as Role[] | undefined;

        if (userRoles?.includes(Role.SuperAdmin)) {
            return null; 
        }

        if (!clientId) {
            console.error("ProductRepository: Client ID not found in request context.");
            // Throw or handle appropriately - throwing might be safer
            throw new InternalServerErrorException('Client ID not found in request context for repository operation.');
        }

        // Use alias if provided, otherwise default to entity name (safer for complex queries)
        const effectiveAlias = alias ?? this.repository.metadata.name;

        return {
            condition: `${effectiveAlias}.clientId = :clientId`,
            parameters: { clientId },
        };
    }

    // --- Helper to merge tenant condition into Where clauses ---
    private addTenantWhere(
        originalWhere: FindOptionsWhere<Product> | FindOptionsWhere<Product>[] | undefined,
        tenantClientId: string | undefined
    ): FindOptionsWhere<Product> | FindOptionsWhere<Product>[] | undefined {

        if (!tenantClientId) {
            // If no tenant filtering needed (SuperAdmin), return original where
            return originalWhere;
        }

        const tenantWhere = { clientId: tenantClientId };

        if (!originalWhere) {
            return tenantWhere;
        }

        if (Array.isArray(originalWhere)) {
            // Apply to each element in the OR array
            return originalWhere.map(condition => ({ ...condition, ...tenantWhere }));
        }

        // Apply to the single where object
        return { ...originalWhere, ...tenantWhere };
    }


    // --- Custom Read Methods with Tenant Filtering ---

    createQueryBuilder(alias: string = 'product', queryRunner?: any): SelectQueryBuilder<Product> {
        // Start with the standard repository's query builder
        const qb = this.repository.createQueryBuilder(alias, queryRunner);
        const tenantCondition = this.getTenantCondition(alias); // Pass alias

        // Apply tenant condition if applicable
        if (tenantCondition) {
            qb.andWhere(tenantCondition.condition, tenantCondition.parameters);
        }
        return qb;
    }

    async findOne(options: FindOneOptions<Product>): Promise<Product | null> {
        const tenantCondition = this.getTenantCondition(); // Alias not directly applicable here
        const finalWhere = this.addTenantWhere(options.where, tenantCondition?.parameters.clientId);

        // Use the standard repository's findOne with the modified where clause
        return this.repository.findOne({
            ...options, // Spread other options like relations, order, select
            where: finalWhere,
        });
    }

     async findOneBy(where: FindOptionsWhere<Product> | FindOptionsWhere<Product>[]): Promise<Product | null> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(where, tenantCondition?.parameters.clientId);

        // Use the standard repository's findOneBy with the modified where clause
        return this.repository.findOneBy(finalWhere || {});
    }

    async find(options?: FindManyOptions<Product>): Promise<Product[]> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(options?.where, tenantCondition?.parameters.clientId);

        // Use the standard repository's find with the modified where clause
        return this.repository.find({
             ...options, // Spread other options like relations, order, skip, take, select
             where: finalWhere,
        });
    }

     async findBy(where: FindOptionsWhere<Product> | FindOptionsWhere<Product>[]): Promise<Product[]> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(where, tenantCondition?.parameters.clientId);

        // Use the standard repository's findBy with the modified where clause
        return this.repository.findBy(finalWhere || {});
    }

    async findAndCount(options?: FindManyOptions<Product>): Promise<[Product[], number]> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(options?.where, tenantCondition?.parameters.clientId);

        return this.repository.findAndCount({
            ...options,
            where: finalWhere,
        });
    }

    // --- Delegated Write Methods (Using the standard injected repository) ---

    /**
     * Creates a new instance of Product.
     * Service layer should ensure clientId is set correctly based on roles before calling save.
     */
    /**
     * Creates one or multiple new instances of Product.
     * Service layer should ensure clientId is set correctly based on roles before calling save.
     */
    create(entityLikeOrLikes: DeepPartial<Product> | DeepPartial<Product>[]): Product | Product[] {
        return Array.isArray(entityLikeOrLikes)
            ? this.repository.create(entityLikeOrLikes)
            : this.repository.create([entityLikeOrLikes])[0];
    }

    /**
     * Saves a given entity or array of entities.
     * If the entity already exists in the database, it is updated.
     * If the entity does not exist in the database, it is inserted.
     * The TenantSubscriber can handle default clientId on insert if not set by the service.
     */
    async save<T extends DeepPartial<Product>>(entity: T, options?: SaveOptions): Promise<T>
    async save<T extends DeepPartial<Product>>(entities: T[], options?: SaveOptions): Promise<T[]>
    async save<T extends DeepPartial<Product>>(entityOrEntities: T | T[], options?: SaveOptions): Promise<T | T[]> {
        return this.repository.save(entityOrEntities as any, options); // Type assertion might be needed
    }

    /**
     * Removes a given entity or array of entities.
     * Requires the entity instance fetched respecting tenant isolation.
     */
    async remove(entity: Product, options?: RemoveOptions): Promise<Product>
    async remove(entities: Product[], options?: RemoveOptions): Promise<Product[]>
    async remove(entityOrEntities: Product | Product[], options?: RemoveOptions): Promise<Product | Product[]> {
        // This should now work correctly using the standard repository's manager
        return this.repository.remove(entityOrEntities as any, options);
    }

    /**
     * Deletes entities by a given criteria.
     * WARNING: This method bypasses tenant filtering applied by findOne/find.
     * It's generally safer to fetch entities using find/findOne (which apply tenant rules)
     * and then pass those instances to remove(). Use with extreme caution in multi-tenant apps.
     */
    async delete(criteria: FindOptionsWhere<Product> | string | string[], options?: any): Promise<DeleteResult> {
        console.warn('ProductRepository.delete bypasses tenant filtering. Use remove(entity) after fetching for safety.');
        // If you MUST use delete, manually add tenant criteria here if not SuperAdmin
        const tenantCondition = this.getTenantCondition();
        let finalCriteria = criteria as any; // Start with original criteria

        if (tenantCondition?.parameters.clientId) {
            const tenantClientId = tenantCondition.parameters.clientId;
            if (typeof finalCriteria === 'string' || Array.isArray(finalCriteria)) {
                 // Cannot safely apply tenant filter to ID strings/arrays without fetching first
                 throw new Error('Cannot safely apply tenant filter to delete by ID(s). Fetch and use remove().');
            } else if (typeof finalCriteria === 'object') {
                 // Merge tenant clientId into the where object
                 finalCriteria = { ...finalCriteria, clientId: tenantClientId };
            }
        }
        // Proceed with caution
        return this.repository.delete(finalCriteria);
    }


    // --- Expose metadata or other Repository methods if needed ---
    get metadata() {
        return this.repository.metadata;
    }

    // Example: Exposing count
    async count(options?: FindManyOptions<Product>): Promise<number> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(options?.where, tenantCondition?.parameters.clientId);
        return this.repository.count({ ...options, where: finalWhere });
    }

     async countBy(where: FindOptionsWhere<Product> | FindOptionsWhere<Product>[]): Promise<number> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(where, tenantCondition?.parameters.clientId);
        return this.repository.countBy(finalWhere || {});
    }
}