import { IsString, IsOptional, IsInt, Min, IsBoolean } from 'class-validator';

export class UpdateImageDetailsDto {
  @IsOptional()
  @IsString()
  altText?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}