import { Injectable } from "@nestjs/common";
import { ProductVariant } from "../entities/product-variant.entity";
import { ClsService } from "nestjs-cls";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository,FindOptionsWhere, SelectQueryBuilder,ObjectLiteral, FindOneOptions, FindManyOptions } from "typeorm";

@Injectable()
export class ProductVariantRepository {
    constructor(
        @InjectRepository(ProductVariant) // Inject standard repository
        private readonly repository: Repository<ProductVariant>,
        private readonly cls: ClsService, 
    ) {}

    private getTenantCondition(alias?: string): { condition: string; parameters: ObjectLiteral  } | null {
        const clientId = this.cls.get("clientId");
        const userRoles = this.cls.get("userRoles") as string[] | undefined; // Adjusted to string[] for simplicity

        if (userRoles?.includes("SuperAdmin")) {
            return null; 
        }

        if (!clientId) {
            console.error("ProductVariantRepository: Client ID not found in request context.");
            throw new Error("Client ID not found in request context for repository operation.");
        }

        const effectiveAlias = alias ?? this.repository.metadata.name;

        return {
            condition: `${effectiveAlias}.clientId = :clientId`,
            parameters: { clientId },
        };
    }

    private addTenantWhere(
            originalWhere: FindOptionsWhere<ProductVariant> | FindOptionsWhere<ProductVariant>[] | undefined,
            tenantClientId: string | undefined
        ): FindOptionsWhere<ProductVariant> | FindOptionsWhere<ProductVariant>[] | undefined {
    
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
    
    createQueryBuilder(alias: string = 'variant', queryRunner?: any ): SelectQueryBuilder<ProductVariant> {
        const builder = this.repository.createQueryBuilder(alias, queryRunner);
        const tenantCondition = this.getTenantCondition(alias);

        if (tenantCondition) {
            builder.andWhere(tenantCondition.condition, tenantCondition.parameters);
        }

        return builder;
    }

    async find(options?: FindManyOptions<ProductVariant>): Promise<ProductVariant[]> {
            const tenantCondition = this.getTenantCondition();
            const finalWhere = this.addTenantWhere(options?.where, tenantCondition?.parameters.clientId);
    
            // Use the standard repository's find with the modified where clause
            return this.repository.find({
                 ...options, // Spread other options like relations, order, skip, take, select
                 where: finalWhere,
            });
        }

    async findOne(options: FindOneOptions<ProductVariant>): Promise<ProductVariant | null> {
            const tenantCondition = this.getTenantCondition(); 
            const finalWhere = this.addTenantWhere(options.where, tenantCondition?.parameters.clientId);
    
            return this.repository.findOne({
                ...options, 
                where: finalWhere,
            });
        }

    async findOneBy(where: FindOptionsWhere<ProductVariant> | FindOptionsWhere<ProductVariant>[]): Promise<ProductVariant | null> {
        const tenantCondition = this.getTenantCondition(this.repository.metadata.tableName);
        const finalWhere = this.addTenantWhere(where, tenantCondition?.parameters.clientId);
        return this.repository.findOneBy(finalWhere || {});
    }

    async findAndCount(options?: { where?: FindOptionsWhere<ProductVariant> | FindOptionsWhere<ProductVariant>[] }): Promise<[ProductVariant[], number]> {
        const tenantCondition = this.getTenantCondition(this.repository.metadata.tableName);
        const where = this.addTenantWhere(options?.where, tenantCondition?.parameters.clientId);
        return this.repository.findAndCount({ ...options, where });
    }

    async save(entity: ProductVariant): Promise<ProductVariant> {
        const tenantCondition = this.getTenantCondition(this.repository.metadata.tableName);
        entity.clientId = tenantCondition?.parameters.clientId; // Ensure clientId is set
        return this.repository.save(entity);
    }

    async remove(entity: ProductVariant): Promise<ProductVariant> {
        return this.repository.remove(entity);
    }

    create(entity: Partial<ProductVariant>): ProductVariant {
        const tenantCondition = this.getTenantCondition(this.repository.metadata.tableName);
        entity.clientId = tenantCondition?.parameters.clientId; // Ensure clientId is set
        return this.repository.create(entity);
    }

    get metadata() {
        return this.repository.metadata;
    }

    async count(options?: { where?: FindOptionsWhere<ProductVariant> | FindOptionsWhere<ProductVariant>[] }): Promise<number> {
        const tenantCondition = this.getTenantCondition(this.repository.metadata.tableName);
        const where = this.addTenantWhere(options?.where, tenantCondition?.parameters.clientId);
        return this.repository.count({ ...options, where });
    }

    

}