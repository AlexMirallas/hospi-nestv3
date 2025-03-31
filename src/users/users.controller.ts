import { Controller, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { Crud, CrudController, Feature } from '@nestjsx/crud';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorators';
import { Role } from '../common/enums/role.enum';

@Crud({
  model: {
    type: User,
  },
  dto: {
    create: CreateUserDto,
    update: UpdateUserDto,
    replace: UpdateUserDto, // Often same as update
  },
  query: {
    maxLimit: 100, // Max items per page
    limit: 10,     // Default items per page
    alwaysPaginate: true, // Ensure pagination info is always returned
    exclude: ['password'], // Exclude password from query results automatically
    join: {
      // Define relations that can be joined if needed (not applicable for User here)
      // Example:
      // profile: {
      //   eager: false,
      // },
    },
  },
  routes: {
    // You can customize or disable routes here
    // exclude: ['replaceOneBase'], // Example: disable PUT route
    // Only admins can create, update, delete users
    // Override default route settings
    createOneBase: {
        decorators: [Roles(Role.Admin)],
    },
    createManyBase: {
        decorators: [Roles(Role.Admin)],
    },
    updateOneBase: {
        decorators: [Roles(Role.Admin)],
    },
    replaceOneBase: {
         decorators: [Roles(Role.Admin)],
    },
    deleteOneBase: {
        decorators: [Roles(Role.Admin)],
    },
    // Allow reading users (list and one) for admins
    // getManyBase: { decorators: [Roles(Role.Admin)] }, // Already covered by controller guard
    // getOneBase: { decorators: [Roles(Role.Admin)] }, // Already covered by controller guard
  },
  params: { // Map URL parameter 'id' to the 'id' field of the User entity
      id: {
          field: 'id',
          type: 'uuid', // Adjust if you use numeric IDs
          primary: true,
      },
  },
})
@Controller('users')
// Apply JWT and Role checks to ALL routes in this controller
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin) // Default protection: only Admins access /users routes
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) // Apply validation
@Feature('users-admin') // Feature name for @nestjsx/crud
export class UsersController implements CrudController<User> {
  constructor(public service: UsersService) {}

  // The base CrudController<User> provides the getBase method
  get base(): CrudController<User> {
      return this;
  }

  // You can override specific CRUD methods here if needed
  // For example, to add custom logic or change response format.
  // But for basic CRUD compatible with ra-data-nestjsx-crud,
  // the @Crud() decorator and TypeOrmCrudService handle most of it.

  // Example override (though usually not needed with @nestjsx/crud defaults)
  // @Override()
  // async createOne(
  //   @ParsedRequest() req: CrudRequest,
  //   @ParsedBody() dto: CreateUserDto,
  // ) {
  //   // Custom logic before calling the base service method
  //   console.log('Custom createOne logic');
  //   return this.base.createOneBase(req, dto);
  // }
}


