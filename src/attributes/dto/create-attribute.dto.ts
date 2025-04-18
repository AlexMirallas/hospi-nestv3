import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAttributeDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @IsInt()
    @IsNotEmpty()
    position: number;

    @IsBoolean()
    @IsNotEmpty()
    isActive: boolean;

    @IsOptional()
    @IsUUID()
    clientId?: string;
}