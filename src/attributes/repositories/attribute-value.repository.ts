import { AttributeValue } from '../entities/attribute-value.entity';
import { Injectable } from '@nestjs/common';
import { BaseRepository } from 'src/common/repositories/base.repository';
import { ClsService } from 'nestjs-cls';
import { DataSource } from 'typeorm';

@Injectable()
export class AttributeValueRepository extends BaseRepository<AttributeValue> {
    constructor(
        private dataSource: DataSource,
        cls: ClsService,
    ) {
        super(AttributeValue, dataSource.createEntityManager());
        this.cls = cls;
    }
}