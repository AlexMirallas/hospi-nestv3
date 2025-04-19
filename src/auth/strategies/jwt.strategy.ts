import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { User } from '../../users/entities/user.entity';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private readonly cls: ClsService, 
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }
    
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret, 
    });
  }

  async validate(payload: JwtPayload): Promise<Omit<User, 'password'>> {
    if (!payload.clientId || !payload.roles) {
      console.error('JWT Payload missing clientId or roles:', payload);
      throw new UnauthorizedException('Invalid token payload.');
    }

    this.cls.set('clientId', payload.clientId);
    this.cls.set('userRoles', payload.roles);
    this.cls.set('userId', payload.sub);
    this.cls.set('userEmail', payload.email); 

    const user = await this.usersService.findOne(payload.sub); 
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.clientId !== payload.clientId) {
      console.warn(`Token clientId (${payload.clientId}) does not match user's clientId (${user.clientId}) for user ${user.id}`);
      throw new UnauthorizedException('Client mismatch.');
  }

    Object.defineProperty(user, 'password', { 
      enumerable: false,
      configurable: true,
      value: undefined
    });
    return user;
  }
}
