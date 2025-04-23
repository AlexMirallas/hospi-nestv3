import { PartialType } from '@nestjs/mapped-types'; // Or @nestjs/swagger
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsString, MinLength } from 'class-validator';


export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 8 characters long' })
  password?: string;
}