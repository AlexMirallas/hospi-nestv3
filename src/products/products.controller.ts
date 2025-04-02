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
  NotFoundException,
  BadRequestException,
  ParseUUIDPipe,
  UsePipes,
  ValidationPipe
} from '@nestjs/common';
import { Response } from 'express';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorators';
import { Role } from '../common/enums/role.enum';
import { ProductVariant } from './entities/product-variant.entity';

// Import DTOs
import { CreateProductDto } from './dto/create/create-product.dto';
import { UpdateProductDto } from './dto/update/update-product.dto';


@Controller('products')
@UseInterceptors(ClassSerializerInterceptor) // For transforming responses
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
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

      // Extract values
      const [start, end] = range;
      const [sortField, sortOrder] = sort;

      // Call service
      const { data, total } = await this.productsService.findAllSimpleRest({
        start,
        end,
        sort: sortField,
        order: sortOrder,
        filters: filter
      });
      
      // Set pagination headers
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

  @Get('variants')
  async findVariantsForProduct(
    // Use ParseUUIDPipe (or ParseIntPipe) for validation and type safety
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<ProductVariant[]> {
      
      const variants = await this.productsService.findVariantsByProductId(productId);
      return variants; // Return the array of variants
     
  }


  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id);
  }

  

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() updateProductDto: UpdateProductDto
  ) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    await this.productsService.remove(id);
    res.status(HttpStatus.NO_CONTENT).send();
  }

  // Variant-specific endpoints
  @Get('variants/:id')
  async findVariant(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findVariant(id);
  }

  @Put('variants/:id/stock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async updateVariantStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('quantity') quantity: number
  ) {
    if (isNaN(quantity) || quantity < 0) {
      throw new BadRequestException('Quantity must be a non-negative number');
    }
    
    return this.productsService.updateVariantStock(id, quantity);
  }
}