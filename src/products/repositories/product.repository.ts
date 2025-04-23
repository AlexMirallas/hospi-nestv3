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
            throw new InternalServerErrorException('Client ID not found in request context for repository operation.');
        }

        const effectiveAlias = alias ?? this.repository.metadata.name;

        return {
            condition: `${effectiveAlias}.clientId = :clientId`,
            parameters: { clientId },
        };
    }

    private addTenantWhere(
        originalWhere: FindOptionsWhere<Product> | FindOptionsWhere<Product>[] | undefined,
        tenantClientId: string | undefined
    ): FindOptionsWhere<Product> | FindOptionsWhere<Product>[] | undefined {
        if (!tenantClientId) {
            return originalWhere;
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

    createQueryBuilder(alias: string = 'product', queryRunner?: any): SelectQueryBuilder<Product> {
        const qb = this.repository.createQueryBuilder(alias, queryRunner);
        const tenantCondition = this.getTenantCondition(alias);

        if (tenantCondition) {
            qb.andWhere(tenantCondition.condition, tenantCondition.parameters);
        }
        return qb;
    }

    async findOne(options: FindOneOptions<Product>): Promise<Product | null> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(options.where, tenantCondition?.parameters.clientId);

        return this.repository.findOne({
            ...options,
            where: finalWhere,
        });
    }

    async findOneBy(where: FindOptionsWhere<Product> | FindOptionsWhere<Product>[]): Promise<Product | null> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(where, tenantCondition?.parameters.clientId);

        return this.repository.findOneBy(finalWhere || {});
    }

    async find(options?: FindManyOptions<Product>): Promise<Product[]> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(options?.where, tenantCondition?.parameters.clientId);

        return this.repository.find({
             ...options,
             where: finalWhere,
        });
    }

    async findBy(where: FindOptionsWhere<Product> | FindOptionsWhere<Product>[]): Promise<Product[]> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(where, tenantCondition?.parameters.clientId);

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

    create(entityLikeOrLikes: DeepPartial<Product> | DeepPartial<Product>[]): Product | Product[] {
        return Array.isArray(entityLikeOrLikes)
            ? this.repository.create(entityLikeOrLikes)
            : this.repository.create([entityLikeOrLikes])[0];
    }

    async save<T extends DeepPartial<Product>>(entity: T, options?: SaveOptions): Promise<T>
    async save<T extends DeepPartial<Product>>(entities: T[], options?: SaveOptions): Promise<T[]>
    async save<T extends DeepPartial<Product>>(entityOrEntities: T | T[], options?: SaveOptions): Promise<T | T[]> {
        return this.repository.save(entityOrEntities as any, options);
    }

    async remove(entity: Product, options?: RemoveOptions): Promise<Product>
    async remove(entities: Product[], options?: RemoveOptions): Promise<Product[]>
    async remove(entityOrEntities: Product | Product[], options?: RemoveOptions): Promise<Product | Product[]> {
        return this.repository.remove(entityOrEntities as any, options);
    }

    async delete(criteria: FindOptionsWhere<Product> | string | string[], options?: any): Promise<DeleteResult> {
        console.warn('ProductRepository.delete bypasses tenant filtering. Use remove(entity) after fetching for safety.');
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
