import { Controller, Get, Query, Param, ParseUUIDPipe, NotFoundException,UseInterceptors,Body,Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'; 
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorators'; 
import { CreateProductVariantDto } from './dto/create/create-product-variant.dto'; 
import { ProductsService } from '../products/products.service';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { SimpleRestParams } from '../common/pipes/parse-simple-rest.pipe'; 
import { SimpleRestContentRangeInterceptor, PaginatedResponse } from '../interceptors/global-interceptors'; 
import { Role } from 'src/common/enums/role.enum';
import { ParseSimpleRestParamsPipe } from 'src/common/pipes/parse-simple-rest.pipe';

@Controller('variants')
export class VariantsController {
    constructor(
        private readonly productsService: ProductsService,
    ) {}

    @Post() // Route: POST /products/variants
    @UseGuards(JwtAuthGuard, RolesGuard) 
    @Roles(Role.Admin) 
    addVariant(
      @Body() createVariantDto: CreateProductVariantDto, 
    ): Promise<ProductVariant> {
      return this.productsService.addVariantToProduct(createVariantDto);
    }

    
    // GET /variants - Find variants, filterable by productId 
    @Get()
    @UseInterceptors(SimpleRestContentRangeInterceptor)
    async findAllVariants(
        @Query(ParseSimpleRestParamsPipe) params: SimpleRestParams,
    ): Promise<PaginatedResponse<ProductVariant>> {
        console.log('Controller received PARSED params:', JSON.stringify(params, null, 2));
        const result = await this.productsService.findPaginatedVariants(params);

        return result;
    }

    
    // GET /variants/:id - Find a single variant by its own ID 
    @Get(':id')
    async findOneVariant(
        @Param('id', ParseUUIDPipe) id: string 
    ): Promise<ProductVariant> {
        const variant = await this.productsService.findVariant(id); 
        if (!variant) {
            throw new NotFoundException(`Variant with ID ${id} not found`);
        }
        return variant;
    }



    // @Patch(':id') updateVariant(...)
    // @Delete(':id') removeVariant(...)
}