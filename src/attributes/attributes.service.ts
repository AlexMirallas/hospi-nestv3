import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsOrder,FindOptionsWhere } from 'typeorm';
import { Attribute } from './entities/attribute.entity';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import { AttributeValue } from './entities/attribute-value.entity';
import { CreateAttributeValueDto } from './dto/create-attribute-value.dto';
import { UpdateAttributeValueDto } from './dto/update-attribute-value.dto';
import { SimpleRestParams } from '../users/users.service';

@Injectable()
export class AttributesService {
  constructor(
    @InjectRepository(Attribute)
    private repo: Repository<Attribute>
  ) {}

  async create(createDto: CreateAttributeDto): Promise<Attribute> {
    const attribute = this.repo.create(createDto);
    return this.repo.save(attribute);
  }

  async findAllSimpleRest(
    params: SimpleRestParams,
  ): Promise<{ data: Attribute[]; totalCount: number }> {
    const { start = 0, end = 9, sort, order = 'ASC', filters = {} } = params;
  
    // Calculate TypeORM pagination options
    const take = end - start + 1;
    const skip = start;
  
    // Build TypeORM sorting options
    const orderOptions: FindOptionsOrder<Attribute> = {};
    if (sort) {
      if (this.repo.metadata.hasColumnWithPropertyPath(sort)) {
        orderOptions[sort] = order.toUpperCase() as 'ASC' | 'DESC';
      } else {
        console.warn(`Ignoring invalid sort field: ${sort}`);
        // Default sort if invalid
        orderOptions['id'] = 'ASC';
      }
    } else {
      // Default sort
      orderOptions['id'] = 'ASC';
    }
  
    // Build TypeORM where options for filtering
    const whereOptions: FindOptionsWhere<Attribute> = {};

    // Process filter object
    for (const key in filters) {
      if (
        Object.prototype.hasOwnProperty.call(filters, key) && 
        filters[key] !== undefined &&
        filters[key] !== null
      ) {
        // Check if this is a valid field
        if (this.repo.metadata.hasColumnWithPropertyPath(key)) {
          whereOptions[key] = filters[key];
        } else {
          console.warn(`Ignoring invalid filter field: ${key}`);
        }
      }
    }
    // Fetch data and total count with relations
    const [data, totalCount] = await this.repo.findAndCount({
      where: whereOptions,
      order: orderOptions,
      take: take,
      skip: skip,
      relations: ['values'], // Include attribute values
    });
  
    return { data, totalCount };
  }

  async findOne(id: number): Promise<Attribute> {
    const attribute = await this.repo.findOne({ 
      where: { id },
      relations: ['values']
    });
    
    if (!attribute) {
      throw new NotFoundException(`Attribute with ID ${id} not found`);
    }
    
    return attribute;
  }

  async update(id: number, updateDto: UpdateAttributeDto): Promise<Attribute> {
    const attribute = await this.findOne(id);
    
    Object.assign(attribute, updateDto);
    
    return this.repo.save(attribute);
  }

  async remove(id: number): Promise<void> {
    const attribute = await this.findOne(id);
    await this.repo.remove(attribute);
  }
}



@Injectable()
export class AttributeValuesService {
  constructor(
    @InjectRepository(AttributeValue)
    private repo: Repository<AttributeValue>
  ) {}

  async create(createDto: CreateAttributeValueDto): Promise<AttributeValue> {
    const attributeValue = this.repo.create(createDto);
    return this.repo.save(attributeValue);
  }

  async findAllSimpleRest(
    params: SimpleRestParams,
  ): Promise<{ data: AttributeValue[]; totalCount: number }> {
    const { start = 0, end = 9, sort, order = 'ASC', filters = {} } = params;
  
    // Calculate TypeORM pagination options
    const take = end - start + 1;
    const skip = start;
  
    // Build TypeORM sorting options
    const orderOptions: FindOptionsOrder<AttributeValue> = {};
    if (sort) {
      if (this.repo.metadata.hasColumnWithPropertyPath(sort)) {
        orderOptions[sort] = order.toUpperCase() as 'ASC' | 'DESC';
      } else {
        console.warn(`Ignoring invalid sort field: ${sort}`);
        // Default sort if invalid
        orderOptions['id'] = 'ASC';
      }
    } else {
      // Default sort
      orderOptions['id'] = 'ASC';
    }
  
    // Build TypeORM where options for filtering
    const whereOptions: FindOptionsWhere<AttributeValue> = {};

    for (const key in filters) {
      if (
        Object.prototype.hasOwnProperty.call(filters, key) && 
        filters[key] !== undefined &&
        filters[key] !== null
      ) {
        // Check if this is a valid field
        if (this.repo.metadata.hasColumnWithPropertyPath(key)) {
          whereOptions[key] = filters[key];
        } else {
          console.warn(`Ignoring invalid filter field: ${key}`);
        }
      }
    }
  
    // Fetch data and total count with relations
    const [data, totalCount] = await this.repo.findAndCount({
      where: whereOptions,
      order: orderOptions,
      take: take,
      skip: skip,
      relations: ['attribute'], // Include the parent attribute
    });
  
    return { data, totalCount };
  }


  async findOne(id: number): Promise<AttributeValue> {
    const attributeValue = await this.repo.findOne({ 
      where: { id },
      relations: ['attribute']
    });
    
    if (!attributeValue) {
      throw new NotFoundException(`Attribute Value with ID ${id} not found`);
    }
    
    return attributeValue;
  }

  async update(id: number, updateDto: UpdateAttributeValueDto): Promise<AttributeValue> {
    const attributeValue = await this.findOne(id);
    
    Object.assign(attributeValue, updateDto);
    
    return this.repo.save(attributeValue);
  }

  async remove(id: number): Promise<void> {
    const attributeValue = await this.findOne(id);
    await this.repo.remove(attributeValue);
  }
}