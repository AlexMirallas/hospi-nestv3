import { PartialType } from '@nestjs/mapped-types';
import { CreateAttributeValueDto } from './create-attribute-value.dto';
// No changes needed here if PartialType works as expected,
// it will make hexCode optional automatically.
// If you added complex validation depending on other fields in CreateDTO,
// you might need custom logic here too.
export class UpdateAttributeValueDto extends PartialType(CreateAttributeValueDto) {}