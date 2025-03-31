import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository,FindOptionsWhere, FindOptionsOrder, MoreThanOrEqual, LessThanOrEqual, Like } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';


export interface SimpleRestParams {
  start?: number;
  end?: number;
  sort?: string;
  order?: 'ASC' | 'DESC';
  filters?: Record<string, any>;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>
  ) {}

  async findAllSimpleRest(
    params: SimpleRestParams,
  ): Promise<{ data: User[]; totalCount: number }> {
    const { start = 0, end = 9, sort, order = 'ASC', filters = {} } = params;
  
    // Calculate TypeORM pagination options
    const take = end - start + 1;
    const skip = start;
  
    // Build TypeORM sorting options
    const orderOptions: FindOptionsOrder<User> = {};
    if (sort) {
      if (this.usersRepository.metadata.hasColumnWithPropertyPath(sort)) {
        orderOptions[sort] = order.toUpperCase() as 'ASC' | 'DESC';
      } else {
        console.warn(`Ignoring invalid sort field: ${sort}`);
        // Default to id if invalid sort field
        orderOptions['id'] = 'ASC';
      }
    } else {
      // Default sort
      orderOptions['id'] = 'ASC';
    }
  
    // Build TypeORM where options for filtering
    const whereOptions: FindOptionsWhere<User> = {};
    
    // Process filter object
    for (const key in filters) {
      if (
        Object.prototype.hasOwnProperty.call(filters, key) && 
        filters[key] !== undefined &&
        filters[key] !== null
      ) {
        // Check if this is a valid field
        if (this.usersRepository.metadata.hasColumnWithPropertyPath(key)) {
          whereOptions[key] = filters[key];
        } else {
          console.warn(`Ignoring invalid filter field: ${key}`);
        }
      }
    }
  
    // Fetch data and total count
    const [data, totalCount] = await this.usersRepository.findAndCount({
      where: whereOptions,
      order: orderOptions,
      take: take,
      skip: skip,
    });
  
    return { data, totalCount };
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
    return user;
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = this.usersRepository.create(createUserDto);
    return this.usersRepository.save(user);
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    
    // Update user properties
    Object.assign(user, updateUserDto);
    
    // Save updated user
    return this.usersRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.usersRepository.remove(user);
  }
}