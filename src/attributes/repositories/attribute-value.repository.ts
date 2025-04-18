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
import { AttributeValue } from '../entities/attribute-value.entity';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class AttributeValueRepository {
    constructor(
        @InjectRepository(AttributeValue)
        private readonly repository: Repository<AttributeValue>,
        private readonly cls: ClsService,
    ) {}

    private getTenantCondition(alias?: string): { condition: string; parameters: ObjectLiteral } | null {
        const clientId = this.cls.get('clientId');
        const userRoles = this.cls.get('userRoles') as Role[] | undefined;

        if (userRoles?.includes(Role.SuperAdmin)) {
            return null;
        }

        if (!clientId) {
            console.error("AttributeValueRepository: Client ID not found in request context.");
            throw new InternalServerErrorException('Client ID not found in request context for repository operation.');
        }

        const effectiveAlias = alias ?? this.repository.metadata.name;

        return {
            condition: `${effectiveAlias}.clientId = :clientId`,
            parameters: { clientId },
        };
    }

    private addTenantWhere(
        originalWhere: FindOptionsWhere<AttributeValue> | FindOptionsWhere<AttributeValue>[] | undefined,
        tenantClientId: string | undefined
    ): FindOptionsWhere<AttributeValue> | FindOptionsWhere<AttributeValue>[] | undefined {
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

    createQueryBuilder(alias: string = 'attribute_value', queryRunner?: any): SelectQueryBuilder<AttributeValue> {
        const qb = this.repository.createQueryBuilder(alias, queryRunner);
        const tenantCondition = this.getTenantCondition(alias);
        if (tenantCondition) {
            qb.andWhere(tenantCondition.condition, tenantCondition.parameters);
        }
        return qb;
    }

    async findOne(options: FindOneOptions<AttributeValue>): Promise<AttributeValue | null> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(options.where, tenantCondition?.parameters.clientId);
        return this.repository.findOne({ ...options, where: finalWhere });
    }

    async findOneBy(where: FindOptionsWhere<AttributeValue> | FindOptionsWhere<AttributeValue>[]): Promise<AttributeValue | null> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(where, tenantCondition?.parameters.clientId);
        if (finalWhere === undefined) {
            console.warn("AttributeValueRepository.findOneBy resulted in an undefined where clause unexpectedly.");
            return null;
        }
        return this.repository.findOneBy(finalWhere);
    }

    async find(options?: FindManyOptions<AttributeValue>): Promise<AttributeValue[]> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(options?.where, tenantCondition?.parameters.clientId);
        return this.repository.find({ ...options, where: finalWhere });
    }

    async findBy(where: FindOptionsWhere<AttributeValue> | FindOptionsWhere<AttributeValue>[]): Promise<AttributeValue[]> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(where, tenantCondition?.parameters.clientId);
        if (finalWhere === undefined) {
            console.warn("AttributeValueRepository.findBy resulted in an undefined where clause unexpectedly.");
            return [];
        }
        return this.repository.findBy(finalWhere);
    }

    async findAndCount(options?: FindManyOptions<AttributeValue>): Promise<[AttributeValue[], number]> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(options?.where, tenantCondition?.parameters.clientId);
        return this.repository.findAndCount({ ...options, where: finalWhere });
    }

    create(entityLike: DeepPartial<AttributeValue>): AttributeValue
    create(entityLikes: DeepPartial<AttributeValue>[]): AttributeValue[]
    create(entityLikeOrLikes: DeepPartial<AttributeValue> | DeepPartial<AttributeValue>[]): AttributeValue | AttributeValue[] {
        return this.repository.create(entityLikeOrLikes as any);
    }

    async save<T extends DeepPartial<AttributeValue>>(entity: T, options?: SaveOptions): Promise<T>
    async save<T extends DeepPartial<AttributeValue>>(entities: T[], options?: SaveOptions): Promise<T[]>
    async save<T extends DeepPartial<AttributeValue>>(entityOrEntities: T | T[], options?: SaveOptions): Promise<T | T[]> {
        return this.repository.save(entityOrEntities as any, options);
    }

    async remove(entity: AttributeValue, options?: RemoveOptions): Promise<AttributeValue>
    async remove(entities: AttributeValue[], options?: RemoveOptions): Promise<AttributeValue[]>
    async remove(entityOrEntities: AttributeValue | AttributeValue[], options?: RemoveOptions): Promise<AttributeValue | AttributeValue[]> {
        return this.repository.remove(entityOrEntities as any, options);
    }

    async delete(criteria: FindOptionsWhere<AttributeValue> | string | string[], options?: any): Promise<DeleteResult> {
        console.warn('AttributeValueRepository.delete bypasses tenant filtering. Use remove(entity) after fetching for safety.');
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

    async count(options?: FindManyOptions<AttributeValue>): Promise<number> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(options?.where, tenantCondition?.parameters.clientId);
        return this.repository.count({ ...options, where: finalWhere });
    }

    async countBy(where: FindOptionsWhere<AttributeValue> | FindOptionsWhere<AttributeValue>[]): Promise<number> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(where, tenantCondition?.parameters.clientId);
        if (finalWhere === undefined) {
            console.warn("AttributeValueRepository.countBy resulted in an undefined where clause unexpectedly.");
            return 0;
        }
        return this.repository.countBy(finalWhere);
    }
}
