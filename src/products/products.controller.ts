import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  UseGuards, 
  Query, 
  DefaultValuePipe, 
  ParseIntPipe, 
  UsePipes, 
  ValidationPipe,
  Res,
  HttpStatus,
  Put,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorators';
import { Role } from '../common/enums/role.enum';
import { Product } from './entities/product.entity';
import { Response } from 'express';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(Role.Admin)
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  async findAll(
    @Query('filter') filterString: string = '{}',
    @Query('range') rangeString: string = '[0,9]',
    @Query('sort') sortString: string = '["id","ASC"]',
    @Res({ passthrough: true }) res: Response,
  ): Promise<Product[]>{
    try {
      // Parse the query parameters
      const filter = JSON.parse(filterString);
      const range = JSON.parse(rangeString);
      const sort = JSON.parse(sortString);

      // Extract values
      const [start, end] = range;
      const [sortField, sortOrder] = sort;

      // Call service with extracted parameters
      const { data, total } = await this.productsService.findAllSimpleRest({
        start,
        end,
        sort: sortField,
        order: sortOrder,
        filters: filter,
      });
      res.header(
        'Content-Range', 
        `products ${start}-${Math.min(end, total - 1)}/${total}`,
      );
      res.status(HttpStatus.OK);
      
      // Make sure header is exposed via CORS
      res.header('Access-Control-Expose-Headers', 'Content-Range');
      


      return data;
    } catch (error) {
      console.error('Error processing request:', error);
      throw error;
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Put(':id') 
    async update(
        @Param('id', ParseUUIDPipe) id: string, 
        @Body() updateProductDto: UpdateProductDto 
    ) {
        try {
            const updatedProduct = await this.productsService.update(id, updateProductDto);
            return updatedProduct; 
        } catch (error) {
            if (error instanceof NotFoundException) { 
                throw new NotFoundException(`Product with ID ${id} not found`);
            }
            throw error;
        }
    }

  @Delete(':id')
  @Roles(Role.Admin)
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}