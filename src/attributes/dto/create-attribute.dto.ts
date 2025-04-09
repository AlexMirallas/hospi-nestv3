import { IsBoolean, IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';

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
}