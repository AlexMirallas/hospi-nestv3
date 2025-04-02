import { ProductResponseDto } from './product-response.dto';

export class PaginatedProductsResponseDto {
  data: ProductResponseDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}