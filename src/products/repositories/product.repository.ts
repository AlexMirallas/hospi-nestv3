import { Injectable } from "@nestjs/common";
import { BaseRepository } from "src/common/repositories/base.repository";
import { ClsService } from "nestjs-cls";
import { Product } from "../entities/product.entity";
import { DataSource } from "typeorm";


@Injectable()
export class ProductRepository extends BaseRepository<Product> {
    constructor(
        private dataSource: DataSource,
        cls: ClsService, 
    ) {
        super(Product, dataSource.createEntityManager())
        this.cls = cls;
    }
    
}