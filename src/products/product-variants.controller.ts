import { Controller, Get, Query, Param, ParseUUIDPipe, NotFoundException,UseInterceptors,Body,Post, UseGuards, Put, Delete } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'; 
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorators'; 
import { CreateProductVariantDto } from './dto/create/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update/update-product-variant.dto'; 
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

    @Post() 
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
        const result = await this.productsService.findPaginatedVariants(params);

        return result;
    }

    
    // GET /variants/:id - Find a single variant by its own ID 
    @Get(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Admin)
    async findOneVariant(
        @Param('id', ParseUUIDPipe) id: string 
    ): Promise<ProductVariant> {
        const variant = await this.productsService.findVariant(id); 
        if (!variant) {
            throw new NotFoundException(`Variant with ID ${id} not found`);
        }
        return variant;
    }



    @Put(':variantId') 
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Admin) 
    @UseInterceptors(SimpleRestContentRangeInterceptor) 
    updateVariant(
        @Param('variantId', ParseUUIDPipe) variantId: string, 
        @Body() updateVariantDto: UpdateProductVariantDto,    
    ): Promise<ProductVariant> {
    console.log('Updating variant with ID:', variantId, 'with data:', updateVariantDto);
    return this.productsService.updateVariant(variantId, updateVariantDto);
    }

    @Delete(':variantId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Admin)
    async removeVariant(
        @Param('variantId', ParseUUIDPipe) variantId: string,
    ): Promise<void> {
        const variant = await this.productsService.findVariant(variantId); 
        if (!variant) {
            throw new NotFoundException(`Variant with ID ${variantId} not found`);
        }
        return this.productsService.removeVariant(variantId);
    }

}