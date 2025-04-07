import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Delete, 
  UseGuards, 
  Query, 
  UsePipes, 
  ValidationPipe,
  Res,
  Put,
  UseInterceptors,
} from '@nestjs/common';
import { AttributesService } from './attributes.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorators';
import { Role } from '../common/enums/role.enum';
import { SimpleRestContentRangeInterceptor } from '../interceptors/global-interceptors';
import { AttributeValuesService } from './attributes.service';
import { CreateAttributeValueDto } from './dto/create-attribute-value.dto';
import { UpdateAttributeValueDto } from './dto/update-attribute-value.dto';
import { Attribute } from './entities/attribute.entity';
import { AttributeValue } from './entities/attribute-value.entity';
import { Response } from 'express';

@Controller('attributes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
@UseInterceptors(SimpleRestContentRangeInterceptor) // For transforming responses
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  @Post()
  create(@Body() createAttributeDto: CreateAttributeDto) {
    return this.attributesService.create(createAttributeDto);
  }

  @Get()
  async findAll(
    @Query('filter') filterString: string = '{}',
    @Query('range') rangeString: string = '[0,9]',
    @Query('sort') sortString: string = '["id","ASC"]',
    @Res({ passthrough: true }) res: Response,
  ): Promise<Attribute[]> {
    try {
      // Parse the query parameters
      const filter = JSON.parse(filterString);
      const range = JSON.parse(rangeString);
      const sort = JSON.parse(sortString);

      // Extract values
      const [start, end] = range;
      const [sortField, sortOrder] = sort;

      // Call service with extracted parameters
      const { data, totalCount } = await this.attributesService.findAllSimpleRest({
        start,
        end,
        sort: sortField,
        order: sortOrder,
        filters: filter,
      });
      
      res.header(
        'Content-Range', 
        `attributes ${start}-${Math.min(end, totalCount - 1)}/${totalCount}`
      );
      
      
      res.header('Access-Control-Expose-Headers', 'Content-Range');

      return data;
    } catch (error) {
      console.error('Error processing request:', error);
      throw error;
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.attributesService.findOne(+id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateAttributeDto: UpdateAttributeDto) {
    return this.attributesService.update(+id, updateAttributeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.attributesService.remove(+id);
  }
}




@Controller('attribute-values')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class AttributeValuesController {
  constructor(private readonly attributeValuesService: AttributeValuesService) {}

  @Post()
  create(@Body() createDto: CreateAttributeValueDto) {
    console.log('Creating attribute value:', createDto);
    return this.attributeValuesService.create(createDto);
  }

  @Get()
  async findAll(
    @Query('filter') filterString: string = '{}',
    @Query('range') rangeString: string = '[0,9]',
    @Query('sort') sortString: string = '["id","ASC"]',
    @Res({ passthrough: true }) res: Response,
  ): Promise<AttributeValue[]> {
    try {
      const filter = JSON.parse(filterString);
      const range = JSON.parse(rangeString);
      const sort = JSON.parse(sortString);

      const [start, end] = range;
      const [sortField, sortOrder] = sort;

      const { data, total } = await this.attributeValuesService.findAllSimpleRest({
        start,
        end,
        sort: sortField,
        order: sortOrder,
        filters: filter,
      });

      // Set Content-Range header in the format React Admin expects
      res.header(
        'Content-Range', 
        `attribute-values ${start}-${Math.min(end, total - 1)}/${total}`
      );
      
      // Make sure header is exposed via CORS
      res.header('Access-Control-Expose-Headers', 'Content-Range');

      return data;
    } catch (error) {
      console.error('Error processing request:', error);
      throw error;
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.attributeValuesService.findOne(+id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateAttributeValueDto) {
    return this.attributeValuesService.update(+id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.attributeValuesService.remove(+id);
  }
}