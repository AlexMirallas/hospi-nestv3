import { IsNotEmpty, IsString, IsOptional, IsObject, IsEnum, MaxLength, IsUUID } from 'class-validator';
import { Status } from '../../common/enums/status.enum'; 

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  subdomain?: string;

  @IsEnum(Status)
  @IsOptional()
  status?: Status = Status.Active;

  @IsObject()
  @IsOptional()
  settings?: Record<string, any>;
}