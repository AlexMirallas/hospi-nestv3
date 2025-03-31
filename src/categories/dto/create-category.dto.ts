import { IsString, IsNotEmpty, MaxLength, IsOptional, IsInt, Min } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string; // Optional: can be auto-generated from name

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1) // Assuming category IDs start from 1
  parentId?: number | null; // ID of the parent category
}