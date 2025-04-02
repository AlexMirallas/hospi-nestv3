import { IsUUID, IsString } from 'class-validator';

export class ProductAttributeValueResponseDto {
  @IsUUID()
  id: string;

  @IsUUID()
  attributeId: string;

  @IsString()
  attributeName: string;

  @IsUUID()
  attributeValueId: string;

  @IsString()
  attributeValueName: string;
}