import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { ClsService } from "nestjs-cls";
import { BaseRepository } from "src/common/repositories/base.repository";
import { User } from "../entities/user.entity";

@Injectable()
export class UserRepository extends BaseRepository<User>{
    constructor(
        private dataSource: DataSource,
        cls: ClsService, 
    ) {
        super(User, dataSource.createEntityManager())
        this.cls = cls;
}
async findOneByEmailUnscoped(email: string): Promise<User | null> {
    return this.manager.findOneBy(User, { email });
}
}