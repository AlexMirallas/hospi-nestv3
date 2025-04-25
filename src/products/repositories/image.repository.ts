import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
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
import { ProductImage } from '../entities/image.entity'; // Adjust path if needed
import { Role } from '../../common/enums/role.enum'; // Adjust path if needed
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

@Injectable()
export class ImageRepository {
    private readonly logger = new Logger(ImageRepository.name);

    constructor(
        @InjectRepository(ProductImage)
        private readonly repository: Repository<ProductImage>,
        private readonly cls: ClsService,
    ) {}

    /**
     * Gets the tenant condition based on the current user context.
     * Returns null if the user is SuperAdmin (no automatic filtering).
     * Throws InternalServerErrorException if clientId is missing for non-SuperAdmin.
     */
    private getTenantCondition(alias?: string): { condition: string; parameters: ObjectLiteral } | null {
        const clientId = this.cls.get('clientId');
        const userRoles = this.cls.get('userRoles') as Role[] | undefined;

        this.logger.debug(`getTenantCondition: CLS clientId=${clientId}, roles=${userRoles}`);

        if (userRoles?.includes(Role.SuperAdmin)) {
            this.logger.debug('SuperAdmin detected, returning null for tenant condition.');
            return null; // SuperAdmins are not automatically filtered by tenant
        }

        if (!clientId) {
            this.logger.error("Client ID not found in request context for non-SuperAdmin.");
            throw new InternalServerErrorException('Client ID not found in request context for repository operation.');
        }

        // Use 'image' as default alias if none provided, or use the provided alias
        const effectiveAlias = alias || 'image'; // Default alias for ProductImage
        this.logger.debug(`Applying tenant condition for clientId=${clientId} on alias=${effectiveAlias}`);

        return {
            condition: `${effectiveAlias}.clientId = :cls_clientId`, // Use a distinct param name
            parameters: { cls_clientId: clientId },
        };
    }

    /**
     * Helper to merge the tenant condition's clientId into a TypeORM Where clause.
     */
    private addTenantWhere(
        originalWhere: FindOptionsWhere<ProductImage> | FindOptionsWhere<ProductImage>[] | undefined,
        tenantClientId: string | undefined
    ): FindOptionsWhere<ProductImage> | FindOptionsWhere<ProductImage>[] | undefined {
        if (!tenantClientId) {
            // No tenant filter needed (SuperAdmin or condition already applied elsewhere)
            return originalWhere;
        }

        const tenantWhere = { clientId: tenantClientId };

        if (!originalWhere) {
            return tenantWhere;
        }

        // Handle OR conditions (array of where clauses)
        if (Array.isArray(originalWhere)) {
            return originalWhere.map(condition => ({ ...condition, ...tenantWhere }));
        }

        // Handle single AND condition object
        return { ...originalWhere, ...tenantWhere };
    }

    // --- Tenant-Aware Query Methods ---

    createQueryBuilder(alias: string = 'image', queryRunner?: any): SelectQueryBuilder<ProductImage> {
        const qb = this.repository.createQueryBuilder(alias, queryRunner);
        const tenantCondition = this.getTenantCondition(alias);

        if (tenantCondition) {
            // Apply the condition using the parameters from getTenantCondition
            qb.andWhere(tenantCondition.condition, tenantCondition.parameters);
        }
        return qb;
    }

    async findOne(options: FindOneOptions<ProductImage>): Promise<ProductImage | null> {
        const tenantCondition = this.getTenantCondition();
        // Use helper to merge tenant clientId into the where clause if applicable
        const finalWhere = this.addTenantWhere(options.where, tenantCondition?.parameters.cls_clientId);
        this.logger.debug(`findOne with finalWhere: ${JSON.stringify(finalWhere)}`);

        return this.repository.findOne({
            ...options,
            where: finalWhere, // Use the potentially modified where clause
        });
    }

    async findOneBy(where: FindOptionsWhere<ProductImage> | FindOptionsWhere<ProductImage>[]): Promise<ProductImage | null> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(where, tenantCondition?.parameters.cls_clientId);
        this.logger.debug(`findOneBy with finalWhere: ${JSON.stringify(finalWhere)}`);

        // Ensure findOneBy is called with a valid where clause, even if original was empty
        return this.repository.findOneBy(finalWhere || {});
    }

     async findOneOrFail(options: FindOneOptions<ProductImage>): Promise<ProductImage> {
        const entity = await this.findOne(options);
        if (!entity) {
          this.logger.warn(`findOneOrFail failed for options: ${JSON.stringify(options.where)}`);
          throw new NotFoundException(`ProductImage not found.`);
        }
        return entity;
     }

     async findOneByOrFail(where: FindOptionsWhere<ProductImage> | FindOptionsWhere<ProductImage>[]): Promise<ProductImage> {
        const entity = await this.findOneBy(where);
        if (!entity) {
          this.logger.warn(`findOneByOrFail failed for where: ${JSON.stringify(where)}`);
          throw new NotFoundException(`ProductImage not found.`);
        }
        return entity;
     }

    async find(options?: FindManyOptions<ProductImage>): Promise<ProductImage[]> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(options?.where, tenantCondition?.parameters.cls_clientId);
        this.logger.debug(`find with finalWhere: ${JSON.stringify(finalWhere)}`);

        return this.repository.find({
             ...options,
             where: finalWhere,
        });
    }

    async findBy(where: FindOptionsWhere<ProductImage> | FindOptionsWhere<ProductImage>[]): Promise<ProductImage[]> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(where, tenantCondition?.parameters.cls_clientId);
        this.logger.debug(`findBy with finalWhere: ${JSON.stringify(finalWhere)}`);

        return this.repository.findBy(finalWhere || {});
    }

    async findAndCount(options?: FindManyOptions<ProductImage>): Promise<[ProductImage[], number]> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(options?.where, tenantCondition?.parameters.cls_clientId);
        this.logger.debug(`findAndCount with finalWhere: ${JSON.stringify(finalWhere)}`);

        return this.repository.findAndCount({
            ...options,
            where: finalWhere,
        });
    }

    async count(options?: FindManyOptions<ProductImage>): Promise<number> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(options?.where, tenantCondition?.parameters.cls_clientId);
        this.logger.debug(`count with finalWhere: ${JSON.stringify(finalWhere)}`);
        return this.repository.count({ ...options, where: finalWhere });
    }

    async countBy(where: FindOptionsWhere<ProductImage> | FindOptionsWhere<ProductImage>[]): Promise<number> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(where, tenantCondition?.parameters.cls_clientId);
        this.logger.debug(`countBy with finalWhere: ${JSON.stringify(finalWhere)}`);
        return this.repository.countBy(finalWhere || {});
    }

    // --- Standard Repository Methods (Pass-through or with potential future tenant logic) ---

    // Consider adding automatic clientId setting here if desired for non-SuperAdmins
    create(entityLike: DeepPartial<ProductImage>): ProductImage {
        const { cls_clientId } = this.getTenantCondition()?.parameters || {};
        const userRoles = this.cls.get('userRoles') as Role[] | undefined;
        const isSuperAdmin = userRoles?.includes(Role.SuperAdmin);

        if (!isSuperAdmin && cls_clientId && !entityLike.clientId) {
            this.logger.debug(`Auto-setting clientId=${cls_clientId} on create.`);
            entityLike.clientId = cls_clientId;
        } else if (!entityLike.clientId) {
             this.logger.warn(`Creating ProductImage without explicit clientId (User isSuperAdmin: ${isSuperAdmin}).`);
             // Potentially throw if SuperAdmin MUST provide clientId
             // throw new BadRequestException('SuperAdmin must explicitly provide clientId when creating ProductImage.');
        }
        return this.repository.create(entityLike);
    }

    // Consider adding tenant validation before save for non-SuperAdmins
    async save<T extends DeepPartial<ProductImage>>(entity: T, options?: SaveOptions): Promise<T>
    async save<T extends DeepPartial<ProductImage>>(entities: T[], options?: SaveOptions): Promise<T[]>
    async save<T extends DeepPartial<ProductImage>>(entityOrEntities: T | T[], options?: SaveOptions): Promise<T | T[]> {
        // Add pre-save tenant check if needed:
        // const { cls_clientId } = this.getTenantCondition()?.parameters || {};
        // const isSuperAdmin = !cls_clientId; // Simplified check based on getTenantCondition logic
        // const checkEntity = (e: T) => {
        //    if (!isSuperAdmin && e.clientId !== cls_clientId) throw new ForbiddenException(...);
        // }
        // Array.isArray(entityOrEntities) ? entityOrEntities.forEach(checkEntity) : checkEntity(entityOrEntities);

        return this.repository.save(entityOrEntities as any, options);
    }

    // Consider adding tenant validation before remove for non-SuperAdmins
    async remove(entity: ProductImage, options?: RemoveOptions): Promise<ProductImage>
    async remove(entities: ProductImage[], options?: RemoveOptions): Promise<ProductImage[]>
    async remove(entityOrEntities: ProductImage | ProductImage[], options?: RemoveOptions): Promise<ProductImage | ProductImage[]> {
         // Add pre-remove tenant check if needed (similar to save)
        return this.repository.remove(entityOrEntities as any, options);
    }

    // Delete bypasses tenant checks more easily, use remove for safety
    async delete(criteria: FindOptionsWhere<ProductImage> | string | string[]): Promise<DeleteResult> {
        this.logger.warn('ProductImageRepository.delete might bypass tenant filtering. Use remove(entity) after fetching for safety.');
        // Attempt to apply tenant filter if criteria is an object, but be cautious
        const tenantCondition = this.getTenantCondition();
        let finalCriteria = criteria as any;

        if (tenantCondition?.parameters.cls_clientId) {
            const tenantClientId = tenantCondition.parameters.cls_clientId;
            if (typeof finalCriteria === 'string' || Array.isArray(finalCriteria)) {
                 // Cannot safely apply tenant filter to IDs directly
                 this.logger.error('Cannot safely apply tenant filter to delete by ID(s). Fetch and use remove().');
                 throw new Error('Cannot safely apply tenant filter to delete by ID(s). Fetch and use remove().');
            } else if (typeof finalCriteria === 'object') {
                 // Merge tenantId into the criteria object
                 finalCriteria = { ...finalCriteria, clientId: tenantClientId };
                 this.logger.debug(`Applying tenant filter to delete criteria: ${JSON.stringify(finalCriteria)}`);
            }
        }
        return this.repository.delete(finalCriteria);
    }

     async update(criteria: FindOptionsWhere<ProductImage>, partialEntity: QueryDeepPartialEntity<ProductImage>): Promise<any> {
        const tenantCondition = this.getTenantCondition();
        const finalCriteria = this.addTenantWhere(criteria, tenantCondition?.parameters.cls_clientId);
        this.logger.debug(`update with finalCriteria: ${JSON.stringify(finalCriteria)}`);
        // This ensures non-SuperAdmins can only update their own records based on the criteria
        const resolvedCriteria = Array.isArray(finalCriteria) ? finalCriteria[0] : finalCriteria;
        return this.repository.update(resolvedCriteria || {}, partialEntity);
    }


    get metadata() {
        return this.repository.metadata;
    }
}