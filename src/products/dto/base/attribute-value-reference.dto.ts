import { IsNotEmpty } from 'class-validator';

export class AttributeValueRefDto {
  @IsNotEmpty()
  attributeId: string;

  @IsNotEmpty()
  attributeValueId: string;
}