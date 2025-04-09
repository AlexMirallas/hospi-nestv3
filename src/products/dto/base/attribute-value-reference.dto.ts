import { IsNotEmpty, IsNumber } from 'class-validator';

export class AttributeValueRefDto {
  @IsNotEmpty()
  attributeId: number; 

  @IsNotEmpty()
  attributeValueId: number; 
}