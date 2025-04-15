import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsOrder,FindOptionsWhere,In,ILike } from 'typeorm';
import { Attribute } from './entities/attribute.entity';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import { AttributeValue } from './entities/attribute-value.entity';
import { CreateAttributeValueDto } from './dto/create-attribute-value.dto';
import { UpdateAttributeValueDto } from './dto/update-attribute-value.dto';
import { SimpleRestParams } from '../common/pipes/parse-simple-rest.pipe'; 

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
  
   
    const take = end - start + 1;
    const skip = start;
  
    
    const orderOptions: FindOptionsOrder<Attribute> = {};
    if (sort) {
      if (this.repo.metadata.hasColumnWithPropertyPath(sort)) {
        orderOptions[sort] = order.toUpperCase() as 'ASC' | 'DESC';
      } else {
        console.warn(`Ignoring invalid sort field: ${sort}`);
        
        orderOptions['id'] = 'ASC';
      }
    } else {
      // Default Hala Madrid sort
      orderOptions['id'] = 'ASC';
    }
    
    const whereOptions: FindOptionsWhere<Attribute> | FindOptionsWhere<Attribute>[] = {};

    if (filters) {
      for (const key in filters) {
          if (key === 'id') { 
              const ids = filters[key]; 
              if (Array.isArray(ids) && ids.length > 0) {
                  const numericIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
                  if (numericIds.length > 0) {
                     whereOptions[key] = In(numericIds); 
                  } else {
                     whereOptions[key] = In([-1]);
                  }
              } else if (!isNaN(parseInt(ids, 10))) {
                  whereOptions[key] = parseInt(ids, 10);
              } else {
                  whereOptions[key] = In([-1]); 
              }
          } else if ( false ) {
               // Other filtres in the future if you want. Hala Madrid!
          }
           else {
              // Default 
              whereOptions[key] = filters[key];
          }
      }
  }

    const [data, totalCount] = await this.repo.findAndCount({
      where: whereOptions,
      order: orderOptions,
      take: take,
      skip: skip,
      relations: {
        values: true, 
      }, 
    });
  
    return { data, totalCount };
  }

  async findOne(id: number): Promise<Attribute> {
    const attribute = await this.repo.findOne({ 
      where: { id },
      relations: {
        values: true, 
      }
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
  ): Promise<{ data: AttributeValue[]; total: number }> { // Changed totalCount to total
    const { start = 0, end = 9, sort="id", order = 'ASC', filters = {} } = params;

    const take = end - start + 1;
    const skip = start;

   
    const orderOptions: FindOptionsOrder<AttributeValue> = {};
    if (sort && (this.repo.metadata.hasColumnWithPropertyPath(sort) || sort === 'position')) {
      orderOptions[sort] = order.toUpperCase() as 'ASC' | 'DESC';
    } else {
      console.warn(`findAllSimpleRest (AttributeValue): Ignoring invalid sort field '${sort}', defaulting to 'id ASC'.`);
      orderOptions['id'] = 'ASC'; // Default sort
    }

    
    const whereOptions: FindOptionsWhere<AttributeValue> = {};

    for (const key in filters) {
      if (
        Object.prototype.hasOwnProperty.call(filters, key) &&
        filters[key] !== undefined &&
        filters[key] !== null &&
        filters[key] !== '' 
      ) {
        const filterValue = filters[key];

        
        if (key === 'id') { 
          if (Array.isArray(filterValue) && filterValue.length > 0) {
             const parsedIds = filterValue.map(id => parseInt(String(id), 10)).filter(id => !isNaN(id));
             if (parsedIds.length > 0) {
                 whereOptions.id = In(parsedIds); 
             }
          }
          else if (!Array.isArray(filterValue)) {
              const parsedId = parseInt(String(filterValue), 10);
              if(!isNaN(parsedId)) {
                  whereOptions.id = parsedId; 
              } else {
                   console.warn(`findAllSimpleRest (AttributeValue): Invalid non-numeric ID filter value ignored: ${filterValue}`);
              }
          }
          
        }

        else if (key === 'attributeId') {
             const idValue = Array.isArray(filterValue) ? filterValue[0] : filterValue; 
             if (idValue !== undefined && idValue !== null) {
                 whereOptions.attributeId = parseInt(idValue); 
             }
        }
         else if (this.repo.metadata.hasColumnWithPropertyPath(key)) {
            if (typeof filterValue === 'string') {
              whereOptions[key] = ILike(`%${filterValue}%`); 
            } else {
                 whereOptions[key] = filterValue;
            }
        } else {
          console.warn(`findAllSimpleRest (AttributeValue): Ignoring invalid filter field: ${key}`);
        }
      }
    }

    try {
        const [data, total] = await this.repo.findAndCount({ 
          where: whereOptions,
          order: orderOptions,
          take: take,
          skip: skip,
          relations: {
            attribute: true,
          }
        });

        return { data, total }; 
    } catch (error) {
        console.error("Error during AttributeValue findAndCount:", error);
        console.error("Query Parameters Used:", { where: whereOptions, order: orderOptions, take, skip });
        throw error;
    }
  }

  async findOne(id: number): Promise<AttributeValue> {
    const attributeValue = await this.repo.findOne({ 
      where: { id },
      relations: {
        attribute: true, 
      }
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