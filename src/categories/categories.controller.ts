import { Controller, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { Crud, CrudController, Feature } from '@nestjsx/crud';
import { Category } from './entities/category.entity';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../common/enums/role.enum';
import { Roles } from '../common/decorators/roles.decorators';

@Crud({
  model: {
    type: Category,
  },
  dto: {
    create: CreateCategoryDto,
    update: UpdateCategoryDto,
  },
  params: {
    id: {
      field: 'id',
      type: 'number', // Category ID is number
      primary: true,
    },
    // You might add slug parameter mapping if needed for routes like /categories/slug/:slug
    // slug: {
    //   field: 'slug',
    //   type: 'string',
    // },
  },
  query: {
    maxLimit: 200, // Allow fetching more categories at once if needed
    limit: 20,
    alwaysPaginate: true,
    join: {
      // Allow joining relations via query params (?join=children&join=parent&join=products)
      children: { eager: false },
      parent: { eager: false },
      products: { eager: false, alias: 'categoryProducts' }, // Be careful joining products, could be large
    },
  },
  routes: {
     // Default: Admin only for CUD operations
     createOneBase: { decorators: [Roles(Role.Admin)] },
     createManyBase: { decorators: [Roles(Role.Admin)] },
     updateOneBase: { decorators: [Roles(Role.Admin)] },
     replaceOneBase: { decorators: [Roles(Role.Admin)] },
     deleteOneBase: { decorators: [Roles(Role.Admin)] },
     // Allow anyone (or logged-in user) to read categories
     // Remove @Roles decorator or change role if needed
     getManyBase: { decorators: [] }, // Allow public read? Or add @Roles(Role.User)?
     getOneBase: { decorators: [] },  // Allow public read? Or add @Roles(Role.User)?
  }
})
@Controller('categories')
// Apply guards globally for the controller. Routes config above can override.
@UseGuards(JwtAuthGuard, RolesGuard) // Require login for all category routes by default
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
@Feature('categories-feature')
export class CategoriesController implements CrudController<Category> {
  constructor(public service: CategoriesService) {}

  // Potential custom endpoints for tree structures if needed:
  // @Get('tree')
  // async getTree() {
  //   return this.service.getCategoryTree(); // Assuming service method exists
  // }
}
