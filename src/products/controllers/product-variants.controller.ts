import { Controller, Get, Query, Param, ParseUUIDPipe, NotFoundException,UseInterceptors,Body,Post, UseGuards, Put, Delete, BadRequestException, InternalServerErrorException, ClassSerializerInterceptor } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'; 
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorators'; 
import { CreateProductVariantDto } from '../dto/create/create-product-variant.dto';
import { UpdateProductVariantDto } from '../dto/update/update-product-variant.dto'; 
import { ProductVariantService } from '../services/product-variant.service';
import { ProductVariant } from '../entities/product-variant.entity';
import { SimpleRestParams } from '../../common/pipes/parse-simple-rest.pipe'; 
import { SimpleRestContentRangeInterceptor, PaginatedResponse } from '../../interceptors/global-interceptors'; 
import { Role } from 'src/common/enums/role.enum';
import { ParseSimpleRestParamsPipe } from 'src/common/pipes/parse-simple-rest.pipe';

@Controller('variants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin, Role.SuperAdmin)
@UseInterceptors(ClassSerializerInterceptor)
export class VariantsController {
    constructor(
        private readonly productVariantService: ProductVariantService,
    ) {}

    @Post() 
    addVariant(
      @Body() createVariantDto: CreateProductVariantDto, 
    ): Promise<ProductVariant> {
      return this.productVariantService.addVariantToProduct(createVariantDto);
    }

    
    @Get()
    @UseInterceptors(SimpleRestContentRangeInterceptor)
    async findAll(
        @Query(ParseSimpleRestParamsPipe) params: SimpleRestParams,
    ): Promise<PaginatedResponse<ProductVariant>> {
        const result = await this.productVariantService.findPaginatedVariants(params);

        return result;
    }

    
    @Get(':id')
    async findOne(@Param('id', ParseUUIDPipe) id: string) {
      return this.productVariantService.findOne(id);
  }



    @Put(':variantId') 
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Admin) 
    @UseInterceptors(SimpleRestContentRangeInterceptor) 
    async updateVariant(
        @Param('variantId', ParseUUIDPipe) variantId: string, 
        @Body() updateVariantDto: UpdateProductVariantDto,    
    ): Promise<ProductVariant> {
      try {
        console.log('Updating variant with ID:', variantId, 'with data:', updateVariantDto);
        return await this.productVariantService.updateVariant(variantId, updateVariantDto);
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw error;
        }
        if (error instanceof BadRequestException) {
          throw error;
        }
        console.error(`Error updating variant ${variantId}:`, error);
        throw new InternalServerErrorException(`Failed to update variant: ${error.message}`);
      }
    }

    @Delete(':variantId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.Admin, Role.SuperAdmin)
    async removeVariant(
        @Param('variantId', ParseUUIDPipe) variantId: string,
    ): Promise<void> {
        const variant = await this.productVariantService.findOne(variantId); 
        if (!variant) {
            throw new NotFoundException(`Variant with ID ${variantId} not found`);
        }
        return this.productVariantService.removeVariant(variantId);
    }

}