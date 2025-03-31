import { Role } from '../../common/enums/role.enum';

export interface JwtPayload {
  sub: string; // Subject (user ID)
  email: string;
  roles: Role[];
}