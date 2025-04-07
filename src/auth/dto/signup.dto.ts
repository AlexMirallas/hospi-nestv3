import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, MaxLength } from 'class-validator';



export class SignUpDto {
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  @IsNotEmpty({ message: 'Email cannot be empty.' })
  @MaxLength(255)
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password cannot be empty.' })
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  @MaxLength(100)
  // @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, { message: 'Password too weak' }) //Uncomment if you want to enforce a strong password policy
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'First name cannot be empty.' })
  @MaxLength(100)
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'Last name cannot be empty.' })
  @MaxLength(100)
  lastName: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  // NOTE: Roles are NOT included here. They are assigned default 'User' role by the service.
}