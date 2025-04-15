import { Injectable } from '@nestjs/common';
import { BaseRepository } from 'src/common/repositories/base.repository';
import { Attribute } from '../entities/attribute.entity';
import { ClsService } from 'nestjs-cls';
import { DataSource } from 'typeorm';

@Injectable()
export class AttributeRepository extends BaseRepository<Attribute> {
    constructor(
        private dataSource: DataSource,
        cls: ClsService,
    ) {
        super(Attribute, dataSource.createEntityManager());
        this.cls = cls;
    }
}