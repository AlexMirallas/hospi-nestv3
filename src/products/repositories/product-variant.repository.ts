import { Injectable } from "@nestjs/common";
import { BaseRepository } from "src/common/repositories/base.repository";
import { ProductVariant } from "../entities/product-variant.entity";
import { ClsService } from "nestjs-cls";
import { DataSource } from "typeorm";

@Injectable()
export class ProductVariantRepository extends BaseRepository<ProductVariant>{
    constructor(
        private dataSource: DataSource,
        cls: ClsService, 
    ) {
        super(ProductVariant, dataSource.createEntityManager())
        this.cls = cls;
    }
}