import { Injectable } from "@nestjs/common";
import { BaseRepository } from "src/common/repositories/base.repository";
import { Category } from "../entities/category.entity";
import { ClsService } from "nestjs-cls";
import { DataSource } from "typeorm";

@Injectable()
export class CategoryRepository extends BaseRepository<Category> {
    constructor(
        private dataSource: DataSource,
        cls: ClsService, 
    ) {
        super(Category, dataSource.createEntityManager())
        this.cls = cls;
    }
}
