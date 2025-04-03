import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsOrder,FindOptionsWhere,In } from 'typeorm';
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
    const whereOptions: FindOptionsWhere<Attribute> | FindOptionsWhere<Attribute>[] = {};

    // Process filter object
    if (filters) {
      for (const key in filters) {
          if (key === 'id') { // <--- SPECIAL HANDLING FOR ID FILTER
              const ids = filters[key]; // This will be [4] in the error case
              if (Array.isArray(ids) && ids.length > 0) {
                  // Ensure they are numbers (or strings if UUIDs) before passing to IN
                  // Adjust parseInt based on your actual ID type (number vs string/UUID)
                  const numericIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
                  if (numericIds.length > 0) {
                     whereOptions[key] = In(numericIds); // <--- USE 'In' OPERATOR
                  } else {
                      // Prevent query with invalid filter from running broadly
                     whereOptions[key] = In([-1]); // Pass impossible value if conversion fails
                  }
              } else if (!isNaN(parseInt(ids, 10))) {
                  // Handle case where filter might be passed as single ID: filter={"id": 4}
                  whereOptions[key] = parseInt(ids, 10);
              } else {
                  // Invalid ID format, prevent broad query
                  whereOptions[key] = In([-1]); // Pass impossible value
              }
          } else if (/* other specific filters like name_like, etc. */ false ) {
               // Handle other filters (e.g., using Like() operator)
          }
           else {
              // Default simple equality for other fields (if applicable)
              whereOptions[key] = filters[key];
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
  ): Promise<{ data: AttributeValue[]; total: number }> { // Changed totalCount to total
    const { start = 0, end = 9, sort="id", order = 'ASC', filters = {} } = params;

    const take = end - start + 1;
    const skip = start;

    // Build TypeORM sorting options
    const orderOptions: FindOptionsOrder<AttributeValue> = {};
    // Basic check: refine if you need related field sorting (QueryBuilder is better for that)
    if (sort && (this.repo.metadata.hasColumnWithPropertyPath(sort) || sort === 'id')) {
      orderOptions[sort] = order.toUpperCase() as 'ASC' | 'DESC';
    } else {
      console.warn(`findAllSimpleRest (AttributeValue): Ignoring invalid sort field '${sort}', defaulting to 'id ASC'.`);
      orderOptions['id'] = 'ASC'; // Default sort
    }

    // Build TypeORM where options carefully
    const whereOptions: FindOptionsWhere<AttributeValue> = {};

    for (const key in filters) {
      if (
        Object.prototype.hasOwnProperty.call(filters, key) &&
        filters[key] !== undefined &&
        filters[key] !== null &&
        filters[key] !== '' // Often useful to ignore empty string filters
      ) {
        const filterValue = filters[key];

        // --- Specific Handling for ID Filter ---
        if (key === 'id') {
          // If react-admin sends an array for getMany
          if (Array.isArray(filterValue) && filterValue.length > 0) {
             // Ensure values are of the correct type (e.g., number if ID is integer)
             const parsedIds = filterValue.map(id => parseInt(String(id), 10)).filter(id => !isNaN(id));
             if (parsedIds.length > 0) {
                 whereOptions.id = In(parsedIds); // Use TypeORM's In operator
             }
          }
          // If react-admin sends a single value for filtering
          else if (!Array.isArray(filterValue)) {
              const parsedId = parseInt(String(filterValue), 10);
              if(!isNaN(parsedId)) {
                  whereOptions.id = parsedId; // Assign the primitive number
              } else {
                   console.warn(`findAllSimpleRest (AttributeValue): Invalid non-numeric ID filter value ignored: ${filterValue}`);
              }
          }
          // Ignore empty arrays or other invalid formats
        }
        // --- Specific Handling for attributeId Filter (if used) ---
        // Assumes 'attributeId' is the filter key from frontend, and maps to 'attribute' relation ID
        else if (key === 'attributeId') {
             // ReferenceInput usually sends a single ID
             const idValue = Array.isArray(filterValue) ? filterValue[0] : filterValue; // Handle accidental array wrapping
             if (idValue !== undefined && idValue !== null) {
                 whereOptions.attributeId = parseInt(idValue); 
             }
        }
         // --- Generic Handling for other direct columns ---
         else if (this.repo.metadata.hasColumnWithPropertyPath(key)) {
            // Simple assignment might be okay for other fields, but consider type safety
            // Example: For string fields, you might want ILike
            // if (typeof filterValue === 'string') {
            //   whereOptions[key] = ILike(`%${filterValue}%`); // Import ILike
            // } else {
                 whereOptions[key] = filterValue;
            // }
        } else {
          console.warn(`findAllSimpleRest (AttributeValue): Ignoring invalid filter field: ${key}`);
        }
      }
    }

    try {
        // Fetch data and total count with relations
        const [data, total] = await this.repo.findAndCount({ // Changed totalCount to total
          where: whereOptions,
          order: orderOptions,
          take: take,
          skip: skip,
          relations: ['attribute'], // Include the parent attribute
        });

        return { data, total }; 
    } catch (error) {
        console.error("Error during AttributeValue findAndCount:", error);
        console.error("Query Parameters Used:", { where: whereOptions, order: orderOptions, take, skip });
        // Re-throw the error to be handled by NestJS exception filters
        throw error;
    }
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