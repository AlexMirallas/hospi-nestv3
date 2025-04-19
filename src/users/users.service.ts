import { Injectable, InternalServerErrorException, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { User } from './entities/user.entity';
import { Role } from '../common/enums/role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SimpleRestParams } from '../common/pipes/parse-simple-rest.pipe';
import { UserRepository } from './repositories/user.repository';
import { ClsService } from 'nestjs-cls';
import { Roles } from 'src/common/decorators/roles.decorators';
import * as bcrypt from 'bcrypt';


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
    const currentUserRoles = this.cls.get('userRoles') as Role[] | undefined;
    const currentUserClientId = this.cls.get('clientId') as string | undefined;

    if (!currentUserRoles || !currentUserClientId) {
        throw new InternalServerErrorException('User context not found.');
    }

    const isSuperAdmin = currentUserRoles.includes(Role.SuperAdmin);
    let finalClientId = createUserDto.clientId; 
    let finalRoles = createUserDto.roles ?? [Role.User]; 
    if (isSuperAdmin) {
        if (!finalRoles || finalRoles.length === 0) {
             finalRoles = [Role.User];
        }
    } else if (currentUserRoles.includes(Role.Admin)) {
        finalClientId = currentUserClientId;
        if (finalRoles.includes(Role.SuperAdmin)) {
            throw new ForbiddenException('Admins cannot create SuperAdmin users.');
        }
         if (!finalRoles || finalRoles.length === 0) {
            finalRoles = [Role.User];
       }
    } else {
        throw new ForbiddenException('You do not have permission to create users.');
    }

    const userPayload: Partial<User> = {
        ...createUserDto, 
        clientId: finalClientId, 
        roles: finalRoles, 
    };
 
    if (!userPayload.email) {
        throw new InternalServerErrorException('Email is required to create a user.');
    }
    const existingUser = await this.findOneByEmail(userPayload.email, true);
    if (existingUser) {
        throw new ConflictException('Email address is already registered.');
    }

    try {
        const user = this.usersRepository.create(userPayload);
        return await this.usersRepository.save(user);
    } catch (error) {
         if (error.code === '23505') {
            throw new ConflictException('Email address might already be registered.');
        }
        throw new InternalServerErrorException('Failed to create user.');
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const currentUserRoles = this.cls.get('userRoles') as Role[] | undefined;
    const currentUserClientId = this.cls.get('clientId') as string | undefined;
    const currentUserId = this.cls.get('userId') as string | undefined;

    if (!currentUserRoles || !currentUserClientId || !currentUserId) {
        throw new InternalServerErrorException('User context not found. update');
    }
    const isSuperAdmin = currentUserRoles.includes(Role.SuperAdmin);
    const isAdmin = currentUserRoles.includes(Role.Admin);

    const userToUpdate = await this.findOne(id);

    if (!isSuperAdmin && userToUpdate.clientId !== currentUserClientId) {
        throw new ForbiddenException('You do not have permission to update this user.');
    }
    if (!isSuperAdmin && userToUpdate.roles.includes(Role.SuperAdmin)) {
        throw new ForbiddenException('You do not have permission to modify a SuperAdmin user.');
    }
    if (isAdmin && !isSuperAdmin && userToUpdate.roles.includes(Role.Admin) && userToUpdate.id !== currentUserId) {
        throw new ForbiddenException('Admins cannot modify other Admin users.');
    }

    const changes: Partial<User> = {};

    if (updateUserDto.clientId !== undefined && updateUserDto.clientId !== userToUpdate.clientId) {
        if (!isSuperAdmin) {
            throw new ForbiddenException('Only SuperAdmins can change the client ID.');
        }
        changes.clientId = updateUserDto.clientId;
    }

    if (updateUserDto.roles !== undefined) {
        const newRoles = updateUserDto.roles;
        if (!Array.isArray(newRoles) || newRoles.length === 0) {
             throw new BadRequestException('Roles must be a non-empty array.');
        }
        if (!isSuperAdmin) {
            if (newRoles.includes(Role.SuperAdmin)) {
                throw new ForbiddenException('Admins cannot assign the SuperAdmin role.');
            }
        }
        changes.roles = newRoles;
    }

    if (updateUserDto.email !== undefined && updateUserDto.email !== userToUpdate.email) {
        const existingUser = await this.findOneByEmail(updateUserDto.email, true);
        if (existingUser && existingUser.id !== userToUpdate.id) {
            throw new ConflictException('Email address is already registered by another user.');
       }
        changes.email = updateUserDto.email;
    }

    if (updateUserDto.password) {
        changes.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    const allowedOtherFields: (keyof UpdateUserDto)[] = ['firstName', 'lastName', 'phone', 'roles'];
    for (const key of allowedOtherFields) {
        if (updateUserDto[key] !== undefined) {
            changes[key as keyof Partial<User>] = updateUserDto[key] as any;
        }
    }

    Object.assign(userToUpdate, changes);

    try {
        const updatedUser = await this.usersRepository.save(userToUpdate);
        return updatedUser;
    } catch (error) {
         if (error.code === '23505') {
            throw new ConflictException('Email address might already be registered.');
        }
        throw new InternalServerErrorException('Failed to update user.');
    }
  }

  async remove(id: string): Promise<User> {
    const currentUserRoles = this.cls.get('userRoles') as Role[] | undefined;
    const currentUserClientId = this.cls.get('clientId') as string | undefined;
    const currentUserId = this.cls.get('userId') as string | undefined;

    console.log('Current user roles:', currentUserRoles);
    console.log('Current user client ID:', currentUserClientId);
    console.log('Current user ID:', currentUserId);
    console.log('User ID to delete:', id);

    const isSuperAdmin = currentUserRoles?.includes(Role.SuperAdmin);
    const isAdmin = currentUserRoles?.includes(Role.Admin);

    if (!currentUserRoles || !currentUserClientId || !currentUserId) {
      throw new InternalServerErrorException('User context not found. You are here');
    }

    const userToDelete = await this.findOne(id);

    if (!isSuperAdmin && userToDelete.clientId !== currentUserClientId) {
        throw new ForbiddenException('You do not have permission to delete this user.');
    }

    if (userToDelete.roles.includes(Role.SuperAdmin)) {
        throw new ForbiddenException('SuperAdmin users cannot be deleted.');
    }

    if (userToDelete.id === currentUserId) {
        throw new ForbiddenException('You cannot delete your own account using this method.');
    }

    if (isAdmin && !isSuperAdmin && userToDelete.roles.includes(Role.Admin)) {
        throw new ForbiddenException('Admins cannot delete other Admin users.');
    }

    try {
        await this.usersRepository.remove(userToDelete);
        return userToDelete;
    } catch (error) {
        console.error(`Error removing user with ID ${id}:`, error);
        throw new InternalServerErrorException('Failed to delete user.');
    }
  }

  

}