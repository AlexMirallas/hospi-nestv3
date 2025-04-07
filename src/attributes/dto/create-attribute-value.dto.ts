import { IsNotEmpty, IsString, MaxLength, IsNumber,IsOptional,Matches,IsHexColor, Min } from 'class-validator';

export class CreateAttributeValueDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    value: string; // e.g., Red

    @IsNumber()
    @IsNotEmpty()
    attributeId: number; // Reference to the parent Attribute (e.g., ID for 'Color')

    @IsOptional()
    @IsHexColor() 
    @Matches(/^#([0-9A-F]{6})$/i, { 
         message: 'hexCode must be a valid hex color code (e.g., #FF0000)',
    })
    @MaxLength(7)
    hexCode?: string | null; // e.g., #FF0000

    @IsNumber()
    @IsNotEmpty()
    @Min(0)
    position?: number; 

    
}