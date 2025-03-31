import { ConflictException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { User } from '../users/entities/user.entity';
import { SignUpDto } from './dto/signup.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { Role } from '../common/enums/role.enum'; 

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<Omit<User, 'password' | 'validatePassword' | 'hashPassword' > | null> {
    const user = await this.usersService.findOneByEmail(email);
    if (user && await user.validatePassword(pass)) {
      const { password, ...result } = user; // Exclude password from returned user object
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
     };

    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
   // --- NEW SIGNUP METHOD ---
   async signup(signUpDto: SignUpDto): Promise<{ accessToken: string, user: Omit<User, 'password' | 'validatePassword' | 'hashPassword'> }> {
    // 1. Check if user already exists
    const existingUser = await this.usersService.findOneByEmail(signUpDto.email);
    if (existingUser) {
      throw new ConflictException('Email address is already registered.');
    }

    // 2. Create user object (mapping SignUpDto to CreateUserDto structure)
    const createUserDto: CreateUserDto = {
        ...signUpDto,
        roles: [Role.Admin], // Assign default role explicitly
    };

    let newUser: User;
    try {
        // Use the UsersService to create the user (which uses TypeOrmCrudService internally)
        // Note: TypeOrmCrudService's createOne needs a CrudRequest, which we don't easily have here.
        // It's often better to have a dedicated 'create' method in UsersService or use the repository directly.
        // Let's assume UsersService has a simpler create method or we use the repo directly for simplicity here.

        // Option A: Assuming UsersService has a direct create method:
         newUser = await this.usersService.create(createUserDto); // You'd need to implement this in UsersService

        // Option B: Using the repository directly (requires injecting UserRepository in UsersService or here)
        // const user = this.usersService.repo.create(createUserDto); // Create entity instance
        // newUser = await this.usersService.repo.save(user); // Save (BeforeInsert hook handles hashing)

        // Let's proceed assuming Option A (add `createUserDirectly` to UsersService)

    } catch (error) {
        // Catch potential unique constraint errors etc.
        if (error.code === '23505') { // Example PostgreSQL unique violation code
            throw new ConflictException('Email address is already registered.');
        }
        console.error("Signup Error:", error); // Log the actual error
        throw new InternalServerErrorException('An error occurred during signup.');
    }

    // 3. Generate JWT Token for the new user (auto-login)
    const payload: JwtPayload = {
      email: newUser.email,
      sub: newUser.id,
      roles: newUser.roles,
    };
    const accessToken = this.jwtService.sign(payload);

    // 4. Return token and user data (excluding password)
    const { password, ...userResult } = newUser;
    return {
        accessToken: accessToken,
        user: userResult
    };
  }
  // --- END SIGNUP METHOD ---


  // --- NEW LOGOUT METHOD ---
  async logout(user: User): Promise<{ message: string }> {
      // **Important Note on JWT Logout:**
      // JWTs are stateless. Once issued, a token is valid until it expires.
      // True server-side logout requires maintaining a denylist/blocklist of tokens
      // (e.g., in Redis or a database) and checking it in your JwtStrategy.
      // This adds complexity and statefulness.

      // **Simple Approach (Client-side responsibility):**
      // This endpoint confirms the logout request but relies on the CLIENT
      // to securely delete the JWT. The token remains technically valid on the
      // server until expiry.

      // **More Complex Approaches (not implemented here):**
      // 1. Token Denylist: Store logged-out token IDs (jti claim) until they expire.
      // 2. Refresh Tokens: Use short-lived access tokens and longer-lived refresh tokens.
      //    Logout invalidates the refresh token on the server.

      console.log(`User ${user.email} (ID: ${user.id}) requested logout.`);
      // No server-side action needed for the simple approach.

      return { message: 'Logout successful. Please discard the token.' };
  }
   // --- END LOGOUT METHOD ---
}


