import { ConflictException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { User } from '../users/entities/user.entity';
import { SignUpDto } from './dto/signup.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { Role } from '../common/enums/role.enum';
import { ConfigService } from '@nestjs/config';
import { ClientsService } from 'src/clients/clients.service'; 

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private clientsService: ClientsService,
  ) {}

  async validateUser(email: string, pass: string): Promise<Omit<User, 'password' | 'validatePassword' | 'hashPassword' > | null> {
    const user = await this.usersService.findOneByEmail(email, true);
    if (user && await user.validatePassword(pass)) {
      const { password, ...result } = user;  //Not returning password, dont get confused, hala madrid
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto): Promise<{ accessToken: string }> {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      email: user.email,
      sub: user.id,
      roles: user.roles,
      clientId: user.clientId,
     };

    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
   
   async signup(signUpDto: SignUpDto): Promise<{ accessToken: string, user: Omit<User, 'password' | 'validatePassword' | 'hashPassword'> }> {
    const existingUser = await this.usersService.findOneByEmail(signUpDto.email,true);
    if (existingUser) {
      throw new ConflictException('Email address is already registered.');
    }

    const defaultClientId = this.configService.get<string>('DEFAULT_CLIENT_ID');
    if (!defaultClientId) {
        throw new InternalServerErrorException('Default Client ID not configured for signup.');
    }
    
    const createUserDto: CreateUserDto = {
        ...signUpDto,
        roles: [Role.SuperAdmin], // to change in the future when having a proper method to assign roles
        clientId: defaultClientId,
      };

    

    let newUser: User;
    try { 
         newUser = await this.usersService.create(createUserDto); 
    } catch (error) {
        if (error.code === '23505') { 
            throw new ConflictException('Email address is already registered.');
        }
        console.error("Signup Error:", error); 
        throw new InternalServerErrorException('An error occurred during signup.');
    }

    const payload: JwtPayload = {
      email: newUser.email,
      sub: newUser.id,
      roles: newUser.roles,
      clientId: newUser.clientId,
    };
    const accessToken = this.jwtService.sign(payload);

    const { password, ...userResult } = newUser;
    return {
        accessToken: accessToken,
        user: userResult
    };
  }


  async logout(user: User): Promise<{ message: string }> {
      console.log(`User ${user.email} (ID: ${user.id}) requested logout.`);
      return { message: 'Logout successful. Please discard the token.' };
  }
}


