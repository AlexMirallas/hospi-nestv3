import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TypeOrmCrudService } from '@nestjsx/crud-typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';


@Injectable()
export class UsersService extends TypeOrmCrudService<User> {
  constructor(@InjectRepository(User) repo: Repository<User>) {
    super(repo);
  }

  // Add custom methods if needed, e.g., find by email for auth
  async findOneByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }
   // Custom method needed by JWT strategy
   async findOneById(id: string): Promise<User | undefined> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) {
        throw new NotFoundException(`User with ID "${id}" not found`);
    }
    return user;
  }

  async createUserDirectly(createUserDto: CreateUserDto): Promise<User> {
    const user = this.repo.create(createUserDto); // Creates instance, doesn't save yet
    // BeforeInsert hook in User entity will hash password on save
    await this.repo.save(user);
    return user;
}
  // Note: Password hashing is handled by the @BeforeInsert/Update hook in the User entity
}
