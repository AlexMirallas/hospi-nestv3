import { Role } from '../../common/enums/role.enum';

export interface JwtPayload {
  sub: string; 
  email: string;
  firstName: string;
  lastName: string;
  roles: Role[];
  clientId: string;
}