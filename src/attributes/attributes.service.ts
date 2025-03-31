import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TypeOrmCrudService } from '@nestjsx/crud-typeorm';
import { CrudRequest } from '@nestjsx/crud'; // Import CrudRequest
import { Attribute } from './entities/attribute.entity';
import { AttributeValue } from './entities/attribute-value.entity';
import { CreateAttributeValueDto } from './dto/create-attribute-value.dto';
import { UpdateAttributeValueDto } from './dto/update-attribute-value.dto';


// Keep AttributesService as is, or add findOne method if not extending CrudService
@Injectable()
export class AttributesService extends TypeOrmCrudService<Attribute> {
  constructor(@InjectRepository(Attribute) repo: Repository<Attribute>) {
    super(repo);
  }
   // Ensure a method to fetch one attribute exists
   async findOneWithOptions(options: any): Promise<Attribute | null> {
     return this.repo.findOne(options);
   }
}


@Injectable()
export class AttributeValuesService extends TypeOrmCrudService<AttributeValue> {
  constructor(
      @InjectRepository(AttributeValue) repo: Repository<AttributeValue>,
      // Inject Attribute Repository to check the parent attribute name
      @InjectRepository(Attribute) private readonly attributeRepository: Repository<Attribute>,
      // OR Inject AttributesService if you prefer using its methods
      // private readonly attributesService: AttributesService,
  ) {
    super(repo);
  }

  // ----- Override createOne -----
  async createOne(req: CrudRequest, dto: CreateAttributeValueDto): Promise<AttributeValue> {
    await this.validateHexCodeLogic(dto.attributeId, dto.hexCode);

    // If validation passes, proceed with the default creation logic
    return super.createOne(req, dto);
  }

  // ----- Override updateOne -----
  async updateOne(req: CrudRequest, dto: UpdateAttributeValueDto): Promise<AttributeValue> {
     // For updates, we need the original entity to know the attributeId if it's not in the DTO
     // Or, we require attributeId to be part of the update DTO if it could change (unlikely)
     // Let's assume attributeId doesn't change or is provided in dto if it can.
     // We might need to fetch the entity first to get the attributeId if not in dto.

     const existingValue = await this.findOne(req.parsed.paramsFilter[0].value); // Get ID from request
     if (!existingValue) {
        throw new NotFoundException(`AttributeValue with ID ${req.parsed.paramsFilter[0].value} not found`);
     }

     // Use attributeId from existing entity, or from DTO if provided (though changing attributeId is usually bad)
     const attributeId = existingValue.attributeId;
     // Use hexCode from DTO if provided, otherwise it's not being updated.
     const hexCode = dto.hexCode;

     // Only validate if hexCode is part of the update payload
     if (dto.hasOwnProperty('hexCode')) { // Check if hexCode key exists in the partial DTO
        await this.validateHexCodeLogic(attributeId, hexCode); // Pass the potentially updated hexCode
     }

    // If validation passes, proceed with the default update logic
    // Note: If you cleared hexCode in validateHexCodeLogic for non-color attributes,
    // ensure the DTO passed to super.updateOne reflects that if needed.
    // TypeOrmCrudService update usually handles partial updates correctly.
    return super.updateOne(req, dto);
  }

  // ----- Override replaceOne (PUT) -----
  // Similar logic to updateOne, but dto is expected to be complete
   async replaceOne(req: CrudRequest, dto: UpdateAttributeValueDto): Promise<AttributeValue> {
       const existingValue = await this.findOne(req.parsed.paramsFilter[0].value);
       if (!existingValue) {
          throw new NotFoundException(`AttributeValue with ID ${req.parsed.paramsFilter[0].value} not found`);
       }
       const attributeId = existingValue.attributeId; // Use existing ID
       const hexCode = dto.hexCode; // Hex code from the complete replacement DTO

       await this.validateHexCodeLogic(attributeId, hexCode);

       return super.replaceOne(req, dto);
   }


  // ----- Helper validation function -----
  private async validateHexCodeLogic(attributeId: number, hexCode?: string | null): Promise<void> {
     // Fetch the parent Attribute
    const attribute = await this.attributeRepository.findOne({ where: { id: attributeId } });
    // OR using service: const attribute = await this.attributesService.findOneWithOptions({ where: { id: attributeId } });

    if (!attribute) {
      // This case should ideally be caught by Foreign Key constraints or earlier validation
      throw new BadRequestException(`Attribute with ID ${attributeId} not found.`);
    }

    const isColorAttr = attribute.name?.toLowerCase() === 'color';

    if (isColorAttr) {
      // If it IS a color attribute:
      // Hex code is optional by default based on DTO (@IsOptional)
      // We already have @IsHexColor validation in the DTO.
      // If you want to make it *required* for colors, add the check here:
      // if (!hexCode) {
      //   throw new BadRequestException(`Hex code is required for attribute type 'Color'.`);
      // }
      // If hexCode is provided, the DTO validation (@Matches / @IsHexColor) should have already checked the format.
    } else {
      // If it is NOT a color attribute:
      if (hexCode !== undefined && hexCode !== null) {
         // We received a hex code for a non-color attribute, this is an error.
        throw new BadRequestException(`Hex code ('${hexCode}') is only allowed for attribute type 'Color'. Attribute '${attribute.name}' is not 'Color'.`);
         // Alternatively, you could silently nullify it, but throwing an error is usually better API design.
         // dto.hexCode = null; // If you choose to nullify instead of erroring
      }
      // If hexCode is null or undefined for a non-color attribute, it's valid.
    }
  }
}
