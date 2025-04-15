import { Repository, SelectQueryBuilder, FindOneOptions, FindManyOptions, ObjectLiteral, FindOptionsWhere } from 'typeorm';
import { ClsService } from 'nestjs-cls';
import { Role } from '../enums/role.enum'; // Adjust path as needed

export interface ITenantSpecificEntity {
  clientId: string;
  [key: string]: any; 
}

export abstract class BaseRepository<T extends ITenantSpecificEntity> extends Repository<T> {
  
  // We make it public for simplicity here, but it could be protected
  public cls!: ClsService;

  
  private getTenantCondition(alias: string): { condition: string; parameters: ObjectLiteral } | null {
    const clientId = this.cls.get('clientId');
    const userRoles = this.cls.get('userRoles') as Role[] | undefined; 
    console.log(userRoles, clientId, "Client ID in Base Repository");
    
    if (userRoles?.includes(Role.SuperAdmin)) {
      return null; 
    }

   
    if (!clientId) {
      console.error("Is here", clientId);
      throw new Error('Client ID not found in request context.');
    }
    

    return {
      condition: `${alias}.clientId = :clientId`,
      parameters: { clientId },
    };
  }

  /*
    Overriding all methods used in services to check for clientId or SuperAdmin Role before executing the query.
  */ 

 
  createQueryBuilder(alias?: string, queryRunner?: import('typeorm').QueryRunner): SelectQueryBuilder<T> {
    const builder = super.createQueryBuilder(alias, queryRunner);
    const tenantCondition = this.getTenantCondition(alias || this.metadata.tableName);

    if (tenantCondition) {
      builder.andWhere(tenantCondition.condition, tenantCondition.parameters);
    }

    return builder;
  }

  
  async find(options?: FindManyOptions<T>): Promise<T[]> {
    const tenantCondition = this.getTenantCondition(this.metadata.tableName);
    const where = this.addTenantWhere(options?.where, tenantCondition);
    return super.find({ ...options, where });
  }

  async findOne(options: FindOneOptions<T>): Promise<T | null> {
    const tenantCondition = this.getTenantCondition(this.metadata.tableName);
    const where = this.addTenantWhere(options.where, tenantCondition);
    return super.findOne({ ...options, where });
  }

  async findOneBy(where: FindOptionsWhere<T> | FindOptionsWhere<T>[]): Promise<T | null> {
     const tenantCondition = this.getTenantCondition(this.metadata.tableName);
     const finalWhere = this.addTenantWhere(where, tenantCondition);
     return super.findOneBy(finalWhere);
  }


  private addTenantWhere(
    originalWhere: FindOptionsWhere<T> | FindOptionsWhere<T>[] | undefined,
    tenantCondition: { condition: string; parameters: ObjectLiteral } | null
  ): FindOptionsWhere<T> | FindOptionsWhere<T>[] {
    if (!tenantCondition) {
      return originalWhere || {}; 
    }

    const tenantWhere = { clientId: tenantCondition.parameters.clientId } as FindOptionsWhere<T>;

    if (!originalWhere) {
      return tenantWhere;
    }

   
    if (Array.isArray(originalWhere)) {
      return originalWhere.map(condition => ({ ...condition, ...tenantWhere }));
    }

   
    return { ...originalWhere, ...tenantWhere };
  }
}