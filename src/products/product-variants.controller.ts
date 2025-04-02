import { Controller, Get, Query, Param, ParseUUIDPipe, NotFoundException,UseInterceptors } from '@nestjs/common';
import { ProductsService } from '../products/products.service'; // Inject ProductsService
import { ProductVariant } from '../products/entities/product-variant.entity'; // Import type
import { SimpleRestParams } from '../users/users.service'; // 
import { SimpleRestContentRangeInterceptor, PaginatedResponse } from '../interceptors/global-interceptors'; 

@Controller('variants')
export class VariantsController {
    constructor(
        private readonly productsService: ProductsService,
    ) {}

    /**
     * GET /variants - Find variants, filterable by productId (and potentially others)
     * Compatible with React Admin's getList for ReferenceManyField
     */
    @Get()
    @UseInterceptors(SimpleRestContentRangeInterceptor)
    async findAllVariants(
        // Use @Query decorator to get filter, sort, pagination params
        @Query() params: SimpleRestParams,
    ): Promise<PaginatedResponse<ProductVariant>> {
        // Parse the query parameters
        const result = await this.productsService.findPaginatedVariants(params);

        return result;
    }

    /**
     * GET /variants/:id - Find a single variant by its own ID
     * Useful if you make the Datagrid rows clickable (rowClick="edit")
     */
    @Get(':id')
    async findOneVariant(
        @Param('id', ParseUUIDPipe) id: string // Use ParseIntPipe if variant ID is number
    ): Promise<ProductVariant> {
        // Assuming you have a method to find a single variant by its ID
        const variant = await this.productsService.findVariant(id); // Use the method created earlier
        if (!variant) {
            throw new NotFoundException(`Variant with ID ${id} not found`);
        }
        return variant;
    }

    // Add POST, PATCH, DELETE endpoints here if you need to manage variants individually
    // @Post() createVariant(...)
    // @Patch(':id') updateVariant(...)
    // @Delete(':id') removeVariant(...)
}