import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository,FindOptionsWhere, FindOptionsOrder, MoreThanOrEqual, LessThanOrEqual, Like } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SimpleRestParams } from '../common/pipes/parse-simple-rest.pipe'; // Adjust the path as necessary


/*export interface SimpleRestParams {
  start?: number;
  end?: number;
  sort?: string;
  order?: 'ASC' | 'DESC';
  filters?: Record<string, any>;
}
  */

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>
  ) {}

  // Near the top of your service class:


async findAllSimpleRest(
  params: SimpleRestParams,
): Promise<{ data: User[]; totalCount: number }> {
  const { start = 0, end = 9, sort = 'id', order = 'ASC', filters = {} } = params;

  // Calculate pagination
  const take = end - start + 1;
  const skip = start;

  // Create query builder
  const qb = this.usersRepository.createQueryBuilder('user');

  // Add filters
  for (const key in filters) {
    if (
      Object.prototype.hasOwnProperty.call(filters, key) && 
      filters[key] !== undefined &&
      filters[key] !== null
    ) {
      try {
        if (this.usersRepository.metadata.hasColumnWithPropertyPath(key)) {
          // Get column metadata to check type
          const column = this.usersRepository.metadata.findColumnWithPropertyPath(key);
          
          // Special case for roles column
          if (key === 'roles') {
            // If looking for a single role (string value)
            if (typeof filters[key] === 'string') {
              // Use array contains operator
              qb.andWhere(`user.roles @> ARRAY[:${key}]::users_roles_enum[]`, { 
                [key]: filters[key] 
              });
            }
            // If looking for multiple roles (array value)
            else {
              throw new Error('No user roles filter found in the request');
            }
            continue; // Skip the rest of the loop for this iteration
          }
          
          // Handle other array columns
          if (column?.type === 'simple-array' || column?.type === 'array') {
            // For array columns we need special handling
            if (Array.isArray(filters[key])) {
              // If value is array, use the @> operator (contains)
              qb.andWhere(`user.${key} @> ARRAY[:...${key}Value]::varchar[]`, { 
                [`${key}Value`]: filters[key] 
              });
            } else {
              // For non-array values looking for exact match within array
              qb.andWhere(`user.${key} @> ARRAY[:${key}Value]::varchar[]`, { 
                [`${key}Value`]: filters[key] 
              });
            }
          } else {
            // Regular column, use standard equality
            qb.andWhere(`user.${key} = :${key}Value`, { 
              [`${key}Value`]: filters[key] 
            });
          }
        } else {
          console.warn(`Ignoring invalid filter field in users: ${key}`);
        }
      } catch (error) {
        console.error(`Error with filter ${key}:`, error);
      }
    }
  }

  // Add sorting
  if (this.usersRepository.metadata.hasColumnWithPropertyPath(sort)) {
    qb.orderBy(`user.${sort}`, order as 'ASC' | 'DESC');
  } else {
    qb.orderBy('user.id', 'ASC');
  }

  // Add pagination
  qb.skip(skip).take(take);

  // Execute query
  const [data, totalCount] = await qb.getManyAndCount();

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