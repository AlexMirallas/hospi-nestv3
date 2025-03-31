import { Controller, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { Crud, CrudController, Feature } from '@nestjsx/crud';
import { Product } from './entities/product.entity';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../common/enums/role.enum';
import { Roles } from '../common/decorators/roles.decorators';

@Crud({
  model: { type: Product },
  dto: { create: CreateProductDto, update: UpdateProductDto },
  params: { id: { field: 'id', type: 'uuid', primary: true } },
  query: {
    maxLimit: 100,
    limit: 10,
    alwaysPaginate: true,
    join: {
      // Define relations that can be joined via query param ?join=attributeCombinations
      attributeCombinations: {
          eager: false, // Don't load by default
          // alias: 'variants', // optional alias
      },
      // Allow deeper joins for admin interface if needed
      'attributeCombinations.attributeValue': {
          eager: false,
          // alias: 'attrValue'
      },
       'attributeCombinations.attributeValue.attribute': {
          eager: false,
          // alias: 'attr'
      }
    },
  },
  routes: {
     // Admin only for create/update/delete products
     createOneBase: { decorators: [Roles(Role.Admin)] },
     createManyBase: { decorators: [Roles(Role.Admin)] },
     updateOneBase: { decorators: [Roles(Role.Admin)] },
     replaceOneBase: { decorators: [Roles(Role.Admin)] },
     deleteOneBase: { decorators: [Roles(Role.Admin)] },
     // Allow anyone (or just logged-in users) to view products
     // Remove @Roles(Role.Admin) decorator from get routes if needed
     // Example: allow any logged-in user to view products
     // getManyBase: { decorators: [] }, // Remove admin role requirement, rely on controller guard
     // getOneBase: { decorators: [] },  // Remove admin role requirement, rely on controller guard
  }
})
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard) // Apply JWT guard to all routes
// Default role check (can be overridden per-route in @Crud config)
// Let's allow logged-in users to read, but only admins to write
// So, we remove the @Roles(Role.Admin) here and apply it specifically in Crud config
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
@Feature('products-feature')
export class ProductsController implements CrudController<Product> {
  constructor(public service: ProductsService) {}

   // If you allow non-admins to read, ensure sensitive data isn't exposed.
   // @nestjsx/crud query.exclude might be useful, or use Interceptors/Serializers.
}
