import { Injectable, InternalServerErrorException, NotFoundException,ConflictException, ForbiddenException } from '@nestjs/common';
import { User } from './entities/user.entity';
import { Role } from '../common/enums/role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SimpleRestParams } from '../common/pipes/parse-simple-rest.pipe';
import { UserRepository } from './repositories/user.repository';
import { ClsService } from 'nestjs-cls';


@Injectable()
export class UsersService {
  constructor(
    private usersRepository: UserRepository,
    private readonly cls: ClsService
  ) {}



async findAllSimpleRest(
  params: SimpleRestParams,
): Promise<{ data: User[]; totalCount: number }> {
  const { start = 0, end = 9, sort = 'id', order = 'ASC', filters = {} } = params;


  const take = end - start + 1;
  const skip = start;


  const qb = this.usersRepository.createQueryBuilder('user');

 
  for (const key in filters) {
    if (
      Object.prototype.hasOwnProperty.call(filters, key) && 
      filters[key] !== undefined &&
      filters[key] !== null
    ) {
      try {
        if (this.usersRepository.metadata.hasColumnWithPropertyPath(key)) {
          
          const column = this.usersRepository.metadata.findColumnWithPropertyPath(key);
          
          if (key === 'roles') {
            if (typeof filters[key] === 'string') {
              qb.andWhere(`user.roles @> ARRAY[:${key}]::users_roles_enum[]`, { 
                [key]: filters[key] 
              });
            }
            else {
              throw new Error('No user roles filter found in the request');
            }
            continue; 
          }
          
        
          if (column?.type === 'simple-array' || column?.type === 'array') {
            if (Array.isArray(filters[key])) {
              qb.andWhere(`user.${key} @> ARRAY[:...${key}Value]::varchar[]`, { 
                [`${key}Value`]: filters[key] 
              });
            } else {
              qb.andWhere(`user.${key} @> ARRAY[:${key}Value]::varchar[]`, { 
                [`${key}Value`]: filters[key] 
              });
            }
          } else {
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

  
  if (this.usersRepository.metadata.hasColumnWithPropertyPath(sort)) {
    qb.orderBy(`user.${sort}`, order as 'ASC' | 'DESC');
  } else {
    qb.orderBy('user.id', 'ASC');
  }

  
  qb.skip(skip).take(take);

 
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

  /**
   * @param email 
   * @param unscoped 
   */
  async findOneByEmail(email: string, unscoped: boolean = false): Promise<User | null> {
    if (unscoped) {
      console.log('Unscoped user search:', email);
      return this.usersRepository.findOneByEmailUnscoped(email);
    } else {
      console.log('Scoped user search:', email);
      return this.usersRepository.findOneBy({ email });
    }
  }

  

  async create(createUserDto: CreateUserDto): Promise<User> {
    // Get current user's context from CLS
    const currentUserRoles = this.cls.get('userRoles') as Role[] | undefined;
    const currentUserClientId = this.cls.get('clientId') as string | undefined;

    if (!currentUserRoles || !currentUserClientId) {
        // This shouldn't happen if AuthGuard is working, but good to check
        throw new InternalServerErrorException('User context not found.');
    }

    const isSuperAdmin = currentUserRoles.includes(Role.SuperAdmin);
    let finalClientId = createUserDto.clientId; // Start with DTO value
    let finalRoles = createUserDto.roles ?? [Role.User]; // Default to User if not provided
    if (isSuperAdmin) {
        // SuperAdmin MUST provide a valid clientId (already validated by DTO's @IsNotEmpty)
        // SuperAdmin can assign any role provided in the DTO.
        // We already assigned finalClientId and finalRoles from DTO.
        if (!finalRoles || finalRoles.length === 0) {
             // Ensure roles array is not empty if provided
             finalRoles = [Role.User];
        }
        console.log(`SuperAdmin creating user for client ${finalClientId} with roles ${finalRoles.join(', ')}`);

    } else if (currentUserRoles.includes(Role.Admin)) {
        // Admin creating user:
        console.log(`Admin from client ${currentUserClientId} attempting to create user.`);

        // 1. Force clientId to the Admin's own client
        finalClientId = currentUserClientId;
        console.log(`Overriding clientId to Admin's client: ${finalClientId}`);

        // 2. Prevent Admin from assigning SuperAdmin role
        if (finalRoles.includes(Role.SuperAdmin)) {
            console.warn(`Admin ${currentUserClientId} attempted to create SuperAdmin.`);
            throw new ForbiddenException('Admins cannot create SuperAdmin users.');
        }
         // Ensure roles array is not empty if provided
         if (!finalRoles || finalRoles.length === 0) {
            finalRoles = [Role.User];
       }
        console.log(`Admin creating user for their client ${finalClientId} with roles ${finalRoles.join(', ')}`);

    } else {
        // Should be blocked by RolesGuard, but as a safeguard:
        throw new ForbiddenException('You do not have permission to create users.');
    }

    // Prepare the final payload
    const userPayload: Partial<User> = {
        ...createUserDto, // Spread the original DTO (includes email, password, names, etc.)
        clientId: finalClientId, // Use the determined clientId
        roles: finalRoles, // Use the determined/validated roles
    };

    // Check for existing email (unscoped) before creating
 
 if (!userPayload.email) {
    throw new InternalServerErrorException('Email is required to create a user.');
 }
 const existingUser = await this.findOneByEmail(userPayload.email, true);
    if (existingUser) {
        throw new ConflictException('Email address is already registered.');
    }


    try {
        // Create and save the user using the repository
        // The TenantSubscriber will NOT run here because we are explicitly setting clientId
        const user = this.usersRepository.create(userPayload);
        return await this.usersRepository.save(user);
    } catch (error) {
         // Handle potential database errors (like unique constraints if email check somehow failed)
         if (error.code === '23505') { // Postgres unique violation
            throw new ConflictException('Email address might already be registered.');
        }
        console.error("Error creating user:", error);
        throw new InternalServerErrorException('Failed to create user.');
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    
    Object.assign(user, updateUserDto);
    
    // Save updated user
    return this.usersRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.usersRepository.remove(user);
  }

  

}