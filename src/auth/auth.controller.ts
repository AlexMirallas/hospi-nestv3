import { Controller, Post, Body, UsePipes, ValidationPipe, Request, UseGuards, Get,HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorators';
import { Role } from '../common/enums/role.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { SignUpDto } from './dto/signup.dto';
import { User } from '../users/entities/user.entity'; 


@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED) // Set appropriate HTTP status code for creation
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) // Apply validation
  async signup(@Body() signUpDto: SignUpDto) {
    // No guard needed, this is a public endpoint
    return this.authService.signup(signUpDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(ValidationPipe)
  async login(@Body() loginDto: LoginDto) {
    try {
      console.log('Login attempt:', loginDto);
      const result = await this.authService.login(loginDto);
      console.log('Login result:', result);
      return result;
    } catch (error) {
      console.error('Login error:', error);
      throw new Error(`Authentication failed: ${error.message}`);
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout() {
    return { message: 'Logout successful. Destroy token' };
  }

  // Example protected route to get current user profile
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    // req.user is populated by JwtStrategy.validate
    return req.user;
  }

   // Example admin-only route
   @UseGuards(JwtAuthGuard, RolesGuard)
   @Roles(Role.Admin)
   @Get('admin-check')
   adminCheck(@Request() req: { user: Omit<User, 'password'> }) {
     return { message: 'Admin access granted', user: req.user };
   }
}
