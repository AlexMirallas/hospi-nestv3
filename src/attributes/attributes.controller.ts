import { Controller, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { Crud, CrudController, Feature, Override, ParsedRequest, ParsedBody, CrudRequest } from '@nestjsx/crud';
import { Attribute } from './entities/attribute.entity';
import { AttributesService, AttributeValuesService } from './attributes.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../common/enums/role.enum';
import { Roles } from '../common/decorators/roles.decorators';
import { AttributeValue } from './entities/attribute-value.entity';
import { CreateAttributeValueDto } from './dto/create-attribute-value.dto';
import { UpdateAttributeValueDto } from './dto/update-attribute-value.dto';

// Controller for Attributes
@Crud({
  model: { type: Attribute },
  dto: { create: CreateAttributeDto, update: UpdateAttributeDto },
  query: {
     join: { values: { eager: false } }, // Allow joining values if requested
     maxLimit: 100,
     limit: 10,
     alwaysPaginate: true,
  },
  params: { id: { field: 'id', type: 'number', primary: true } },
  routes: {
     // Admin only for all attribute operations
    // Overrides are inherited from the controller guards/decorators
  }
})
@Controller('attributes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
@Feature('attributes-admin')
export class AttributesController implements CrudController<Attribute> {
  constructor(public service: AttributesService) {}
}

// Controller for AttributeValues (can be nested or separate)
// Let's make it separate for simplicity with ra-data-nestjsx-crud
@Crud({
  model: { type: AttributeValue },
  dto: { create: CreateAttributeValueDto, update: UpdateAttributeValueDto },
  query: {
     join: { attribute: { eager: true } }, // Often useful to see the parent attribute
     maxLimit: 100,
     limit: 10,
     alwaysPaginate: true,
  },
  params: { id: { field: 'id', type: 'number', primary: true } },
   routes: {
    // Admin only for all attribute value operations
    // Overrides are inherited from the controller guards/decorators
  }
})
@Controller('attribute-values')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
@Feature('attribute-values-admin')
export class AttributeValuesController implements CrudController<AttributeValue> {
  constructor(public service: AttributeValuesService) {} // Inject the correct service
  
}
