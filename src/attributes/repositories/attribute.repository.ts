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
import { Attribute } from '../entities/attribute.entity'; 
import { Role } from '../../common/enums/role.enum'; 

@Injectable()
export class AttributeRepository {
    constructor(
        @InjectRepository(Attribute)
        private readonly repository: Repository<Attribute>,
        private readonly cls: ClsService,
    ) {}

    private getTenantCondition(alias?: string): { condition: string; parameters: ObjectLiteral } | null {
        const clientId = this.cls.get('clientId');
        const userRoles = this.cls.get('userRoles') as Role[] | undefined;

        if (userRoles?.includes(Role.SuperAdmin)) {
            return null;
        }

        if (!clientId) {
            console.error("AttributeRepository: Client ID not found in request context.");
            throw new InternalServerErrorException('Client ID not found in request context for repository operation.');
        }

        const effectiveAlias = alias ?? this.repository.metadata.name;

        return {
            condition: `${effectiveAlias}.clientId = :clientId`,
            parameters: { clientId },
        };
    }

    private addTenantWhere(
        originalWhere: FindOptionsWhere<Attribute> | FindOptionsWhere<Attribute>[] | undefined,
        tenantClientId: string | undefined
    ): FindOptionsWhere<Attribute> | FindOptionsWhere<Attribute>[] | undefined {
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

    createQueryBuilder(alias: string = 'attribute', queryRunner?: any): SelectQueryBuilder<Attribute> {
        const qb = this.repository.createQueryBuilder(alias, queryRunner);
        const tenantCondition = this.getTenantCondition(alias);
        if (tenantCondition) {
            qb.andWhere(tenantCondition.condition, tenantCondition.parameters);
        }
        return qb;
    }

    async findOne(options: FindOneOptions<Attribute>): Promise<Attribute | null> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(options.where, tenantCondition?.parameters.clientId);
        return this.repository.findOne({ ...options, where: finalWhere });
    }

    async findOneBy(where: FindOptionsWhere<Attribute> | FindOptionsWhere<Attribute>[]): Promise<Attribute | null> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(where, tenantCondition?.parameters.clientId);
        if (finalWhere === undefined) {
            console.warn("AttributeRepository.findOneBy resulted in an undefined where clause unexpectedly.");
            return null;
        }
        return this.repository.findOneBy(finalWhere);
    }

    async find(options?: FindManyOptions<Attribute>): Promise<Attribute[]> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(options?.where, tenantCondition?.parameters.clientId);
        return this.repository.find({ ...options, where: finalWhere });
    }

    async findBy(where: FindOptionsWhere<Attribute> | FindOptionsWhere<Attribute>[]): Promise<Attribute[]> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(where, tenantCondition?.parameters.clientId);
        if (finalWhere === undefined) {
            console.warn("AttributeRepository.findBy resulted in an undefined where clause unexpectedly.");
            return [];
        }
        return this.repository.findBy(finalWhere);
    }

    async findAndCount(options?: FindManyOptions<Attribute>): Promise<[Attribute[], number]> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(options?.where, tenantCondition?.parameters.clientId);
        return this.repository.findAndCount({ ...options, where: finalWhere });
    }

    create(entityLike: DeepPartial<Attribute>): Attribute
    create(entityLikes: DeepPartial<Attribute>[]): Attribute[]
    create(entityLikeOrLikes: DeepPartial<Attribute> | DeepPartial<Attribute>[]): Attribute | Attribute[] {
        return this.repository.create(entityLikeOrLikes as any);
    }

    async save<T extends DeepPartial<Attribute>>(entity: T, options?: SaveOptions): Promise<T>
    async save<T extends DeepPartial<Attribute>>(entities: T[], options?: SaveOptions): Promise<T[]>
    async save<T extends DeepPartial<Attribute>>(entityOrEntities: T | T[], options?: SaveOptions): Promise<T | T[]> {
        return this.repository.save(entityOrEntities as any, options);
    }

    async remove(entity: Attribute, options?: RemoveOptions): Promise<Attribute>
    async remove(entities: Attribute[], options?: RemoveOptions): Promise<Attribute[]>
    async remove(entityOrEntities: Attribute | Attribute[], options?: RemoveOptions): Promise<Attribute | Attribute[]> {
        return this.repository.remove(entityOrEntities as any, options);
    }

    async delete(criteria: FindOptionsWhere<Attribute> | string | string[], options?: any): Promise<DeleteResult> {
        console.warn('AttributeRepository.delete bypasses tenant filtering. Use remove(entity) after fetching for safety.');
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

    async count(options?: FindManyOptions<Attribute>): Promise<number> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(options?.where, tenantCondition?.parameters.clientId);
        return this.repository.count({ ...options, where: finalWhere });
    }

    async countBy(where: FindOptionsWhere<Attribute> | FindOptionsWhere<Attribute>[]): Promise<number> {
        const tenantCondition = this.getTenantCondition();
        const finalWhere = this.addTenantWhere(where, tenantCondition?.parameters.clientId);
        if (finalWhere === undefined) {
            console.warn("AttributeRepository.countBy resulted in an undefined where clause unexpectedly.");
            return 0;
        }
        return this.repository.countBy(finalWhere);
    }
}
