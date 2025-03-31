import { IsOptional, IsString, IsInt, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class SimpleRestQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  _start?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  _end?: number;

  @IsOptional()
  @IsString()
  _sort?: string;

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  _order?: 'ASC' | 'DESC';

  // These are the fields causing the error - they're sent by React Admin
  @IsOptional()
  filter?: any;

  @IsOptional()
  range?: any;

  @IsOptional()
  sort?: any;

  // Allow any other fields to be used as filters
  [key: string]: any;
}