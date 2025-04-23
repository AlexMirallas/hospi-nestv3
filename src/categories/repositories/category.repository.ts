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
import { Category } from '../entities/category.entity'; // Adjust path if needed
import { Role } from '../../common/enums/role.enum'; // Adjust path if needed

@Injectable()
export class CategoryRepository { // No longer extends BaseRepository
    constructor(
        @InjectRepository(Category)
        private readonly repository: Repository<Category>, // Inject standard repository
        private readonly cls: ClsService,
    ) {}

    // --- Tenant Filtering Logic ---
    private getTenantCondition(alias?: string): { condition: string; parameters: ObjectLiteral } | null {
        const clientId = this.cls.get('clientId');
        const userRoles = this.cls.get('userRoles') as Role[] | undefined;

        if (userRoles?.includes(Role.SuperAdmin)) {
            return null; // SuperAdmin sees all
        }

        if (!clientId) {
            console.error("CategoryRepository: Client ID not found in request context.");
            throw new InternalServerErrorException('Client ID not found in request context for repository operation.');
        }

        const effectiveAlias = alias ?? this.repository.metadata.name;

        return {
            condition: `${effectiveAlias}.clientId = :clientId`,
            parameters: { clientId },
        };
    }

    // --- Helper to merge tenant condition into Where clauses ---
    private addTenantWhere(
        originalWhere: FindOptionsWhere<Category> | FindOptionsWhere<Category>[] | undefined,
        tenantClientId: string | undefined
    ): FindOptionsWhere<Category> | FindOptionsWhere<Category>[] | undefined {

        if (!tenantClientId) {
            return originalWhere; // SuperAdmin or no client context (handled by getTenantCondition)
        }

        const tenantWhere = { clientId: tenantClientId };

        if (!originalWhere) {
            return tenantWhere;
        }

        if (Array.isArray(originalWhere)) {
            return originalWhere.map(condition => ({ ...condition, ...tenantWhere }));
        }

        return { ...originalWhere, ...tenantWhere };
    }


    // --- Custom Read Methods with Tenant Filtering ---

    createQueryBuilder(alias: string = 'category', queryRunner?: any): SelectQueryBuilder<Category> {
        const qb = this.repository.createQueryBuilder(alias, queryRunner);
        const tenantCondition = this.getTenantCondition(alias);
        if (tenantCondition) {
            qb.andWhere(tenantCondition.condition, tenantCondition.parameters);
        }
        return qb;
    }

    async findOne(options: FindOneOptions<Category>): Promise<Category | null> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(options.where, tenantCondition?.parameters.clientId);
        return this.repository.findOne({ ...options, where: finalWhere });
    }

     async findOneBy(where: FindOptionsWhere<Category> | FindOptionsWhere<Category>[]): Promise<Category | null> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(where, tenantCondition?.parameters.clientId);
        // Ensure finalWhere is not undefined for findOneBy
        if (finalWhere === undefined) {
             console.warn("CategoryRepository.findOneBy resulted in an undefined where clause unexpectedly.");
             // Decide handling: return null or throw error if 'where' was initially provided
             return null; // Or throw new Error("Cannot findBy with undefined criteria after tenant filtering");
        }
        return this.repository.findOneBy(finalWhere);
    }

    async find(options?: FindManyOptions<Category>): Promise<Category[]> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(options?.where, tenantCondition?.parameters.clientId);
        return this.repository.find({ ...options, where: finalWhere });
    }

     async findBy(where: FindOptionsWhere<Category> | FindOptionsWhere<Category>[]): Promise<Category[]> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(where, tenantCondition?.parameters.clientId);
        // Ensure finalWhere is not undefined for findBy
        if (finalWhere === undefined) {
             console.warn("CategoryRepository.findBy resulted in an undefined where clause unexpectedly.");
             return []; // Or throw error
        }
        return this.repository.findBy(finalWhere);
    }

    async findAndCount(options?: FindManyOptions<Category>): Promise<[Category[], number]> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(options?.where, tenantCondition?.parameters.clientId);
        return this.repository.findAndCount({ ...options, where: finalWhere });
    }



    create(entityLike: DeepPartial<Category>): Category
    create(entityLikes: DeepPartial<Category>[]): Category[]
    create(entityLikeOrLikes: DeepPartial<Category> | DeepPartial<Category>[]): Category | Category[] {
        return this.repository.create(entityLikeOrLikes as any);
    }

    async save<T extends DeepPartial<Category>>(entity: T, options?: SaveOptions): Promise<T>
    async save<T extends DeepPartial<Category>>(entities: T[], options?: SaveOptions): Promise<T[]>
    async save<T extends DeepPartial<Category>>(entityOrEntities: T | T[], options?: SaveOptions): Promise<T | T[]> {
        return this.repository.save(entityOrEntities as any, options);
    }

    async remove(entity: Category, options?: RemoveOptions): Promise<Category>
    async remove(entities: Category[], options?: RemoveOptions): Promise<Category[]>
    async remove(entityOrEntities: Category | Category[], options?: RemoveOptions): Promise<Category | Category[]> {
        return this.repository.remove(entityOrEntities as any, options);
    }

    /**
     * Deletes entities by a given criteria.
     * WARNING: This method bypasses tenant filtering applied by findOne/find.
     * It's safer to fetch entities using find/findOne (which apply tenant rules)
     * and then pass those instances to remove(). Use with extreme caution in multi-tenant apps.
     */
    async delete(criteria: FindOptionsWhere<Category> | string | string[], options?: any): Promise<DeleteResult> {
        console.warn('CategoryRepository.delete bypasses tenant filtering. Use remove(entity) after fetching for safety.');
        const tenantCondition = this.getTenantCondition();
        let finalCriteria = criteria as any;

        if (tenantCondition?.parameters.clientId) {
            const tenantClientId = tenantCondition.parameters.clientId;
            if (typeof finalCriteria === 'string' || Array.isArray(finalCriteria)) {
                 throw new Error('Cannot safely apply tenant filter to delete by ID(s). Fetch and use remove().');
            } else if (typeof finalCriteria === 'object') {
                 finalCriteria = { ...finalCriteria, clientId: tenantClientId };
            }
        }
        return this.repository.delete(finalCriteria);
    }

    get metadata() {
        return this.repository.metadata;
    }

    async count(options?: FindManyOptions<Category>): Promise<number> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(options?.where, tenantCondition?.parameters.clientId);
        return this.repository.count({ ...options, where: finalWhere });
    }

     async countBy(where: FindOptionsWhere<Category> | FindOptionsWhere<Category>[]): Promise<number> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(where, tenantCondition?.parameters.clientId);
         if (finalWhere === undefined) {
             console.warn("CategoryRepository.countBy resulted in an undefined where clause unexpectedly.");
             return 0; // Or throw error
         }
        return this.repository.countBy(finalWhere);
    }
}
