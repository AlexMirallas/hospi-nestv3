import { PartialType } from '@nestjs/mapped-types'; // Or @nestjs/swagger
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsString, MinLength } from 'class-validator';

// Use PartialType to make all fields optional
export class UpdateUserDto extends PartialType(CreateUserDto) {
  // Override password validation if needed for update (e.g., different min length or optional)
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password?: string;
}