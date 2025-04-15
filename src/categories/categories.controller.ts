import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Put, 
  Param, 
  Delete, 
  UseGuards, 
  Query, 
  UsePipes, 
  ValidationPipe,
  Res
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorators';
import { Role } from '../common/enums/role.enum';
import { Category } from './entities/category.entity';
import { Response } from 'express';
import { SimpleRestParams } from '../common/pipes/parse-simple-rest.pipe';
import { ParseSimpleRestParamsPipe } from '../common/pipes/parse-simple-rest.pipe'; // Adjust the import path as necessary

@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @Roles(Role.Admin, Role.SuperAdmin)
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  async findAll(
    @Query('filter') filterString: string = '{}',
    @Query('range') rangeString: string = '[0,9]',
    @Query('sort') sortString: string = '["id","ASC"]',
    @Res({ passthrough: true }) res: Response,
  ): Promise<Category[]> {
    try {
      // Parse the query parameters
      const filter = JSON.parse(filterString);
      const range = JSON.parse(rangeString);
      const sort = JSON.parse(sortString);

      // Extract values
      const [start, end] = range;
      const [sortField, sortOrder] = sort;

       // Call service with extracted parameters
       const { data, totalCount } = await this.categoriesService.findAllSimpleRest({
        start,
        end,
        sort: sortField,
        order: sortOrder,
        filters: filter,
      });

      // Set Content-Range header in the format React Admin expects
      res.header(
        'Content-Range', 
        `categories ${start}-${Math.min(end, totalCount - 1)}/${totalCount}`
      );
      
      // Make sure header is exposed via CORS
      res.header('Access-Control-Expose-Headers', 'Content-Range');

      return data;
    } catch (error) {
      console.error('Error processing request:', error);
      throw error;
    }
  }

  @Get('tree')
  getTree() {
    return this.categoriesService.getCategoryTree();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(+id);
  }

  @Put(':id')
  @Roles(Role.Admin,Role.SuperAdmin)
  update(@Param('id') id: string, @Body() updateCategoryDto: UpdateCategoryDto) {
    return this.categoriesService.update(+id, updateCategoryDto);
  }

  @Delete(':id')
  @Roles(Role.Admin,Role.SuperAdmin)
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(+id);
  }

  @Get('stats')
  @Roles(Role.Admin,Role.SuperAdmin) 
  @UsePipes(ParseSimpleRestParamsPipe) 
  findWithCount(@Query() params: SimpleRestParams) {
    return this.categoriesService.findWithProductCount(params);
  }
}