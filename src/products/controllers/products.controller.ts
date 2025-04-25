import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  UseGuards,
  Res,
  HttpStatus,
  UseInterceptors,
  ClassSerializerInterceptor,
  BadRequestException,
  ParseUUIDPipe,
  UsePipes,
  ValidationPipe
} from '@nestjs/common';
import { Response } from 'express';
import { ProductsService } from '../services/products.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorators';
import { Role } from '../../common/enums/role.enum';
import { ProductVariant } from '../entities/product-variant.entity';


import { CreateProductDto } from '../dto/create/create-product.dto';
import { UpdateProductDto } from '../dto/update/update-product.dto';



@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin, Role.SuperAdmin)
@UseInterceptors(ClassSerializerInterceptor) 
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin, Role.SuperAdmin)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  async findAll(
    @Query('filter') filterString: string = '{}',
    @Query('range') rangeString: string = '[0,9]',
    @Query('sort') sortString: string = '["id","ASC"]',
    @Res({ passthrough: true }) res: Response
  ) {
    try {
      // Parse the query parameters
      const filter = JSON.parse(filterString);
      const range = JSON.parse(rangeString);
      const sort = JSON.parse(sortString);

      
      const [start, end] = range;
      const [sortField, sortOrder] = sort;

      
      const { data, total } = await this.productsService.findAllSimpleRest({
        start,
        end,
        sort: sortField,
        order: sortOrder,
        filters: filter
      });
      
     
      res.header(
        'Content-Range', 
        `products ${start}-${Math.min(end, total - 1)}/${total}`
      );
      res.header('Access-Control-Expose-Headers', 'Content-Range');
      
      return data;
    } catch (error) {
      console.error("Error fetching products:", error);
      throw new BadRequestException(`Failed to fetch products: ${error.message}`);
    }
  }



  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id);
  }

  

  @Put(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() updateProductDto: UpdateProductDto
  ) {
    return this.productsService.updateProduct(id, updateProductDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    await this.productsService.remove(id);
    res.status(HttpStatus.NO_CONTENT).send();
  }

}