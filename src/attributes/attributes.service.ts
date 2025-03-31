import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attribute } from './entities/attribute.entity';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import { AttributeValue } from './entities/attribute-value.entity';
import { CreateAttributeValueDto } from './dto/create-attribute-value.dto';
import { UpdateAttributeValueDto } from './dto/update-attribute-value.dto';

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

  async findAll(limit = 10, page = 1): Promise<{items: Attribute[], total: number, page: number, pageCount: number}> {
    const [items, total] = await this.repo.findAndCount({
      take: limit,
      skip: (page - 1) * limit,
      relations: ['values']
    });
    
    return {
      items,
      total,
      page,
      pageCount: Math.ceil(total / limit)
    };
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

  async findAll(limit = 10, page = 1): Promise<{items: AttributeValue[], total: number, page: number, pageCount: number}> {
    const [items, total] = await this.repo.findAndCount({
      take: limit,
      skip: (page - 1) * limit,
      relations: ['attribute']
    });
    
    return {
      items,
      total,
      page,
      pageCount: Math.ceil(total / limit)
    };
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