import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';


export interface SimpleRestParams {
  filters: Record<string, any>; 
  sort?: string;                
  order?: 'ASC' | 'DESC';       
  start?: number;               
  end?: number;                 
  range?: [number, number];     
}


@Injectable()
export class ParseSimpleRestParamsPipe implements PipeTransform<any, SimpleRestParams> {
  transform(rawParams: any, metadata: ArgumentMetadata): SimpleRestParams {
    

    if (!rawParams || typeof rawParams !== 'object') {
       return { filters: {}, sort: undefined, order: 'ASC', start: 0, end: 9 }; 
    }

   
    const parsed: SimpleRestParams = {
        filters: {},
        sort: undefined,
        order: 'ASC', 
        start: 0,     
        end: 9,       
    };

   
    if (rawParams.filter && typeof rawParams.filter === 'string') {
      try {
        parsed.filters = JSON.parse(rawParams.filter); 
      } catch (e) {
        console.error('Pipe Error: Failed to parse filter JSON', e);
        throw new BadRequestException('Invalid JSON format for filter parameter');
      }
    }

   
    if (rawParams.sort && typeof rawParams.sort === 'string') {
      try {
        const sortArray = JSON.parse(rawParams.sort);
        if (Array.isArray(sortArray) && sortArray.length === 2 && typeof sortArray[0] === 'string' && typeof sortArray[1] === 'string') {
          parsed.sort = sortArray[0]; 
          parsed.order = sortArray[1].toUpperCase() as 'ASC' | 'DESC';
        } else {
          throw new Error('Sort array format incorrect');
        }
      } catch (e) {
         console.error('Pipe Error: Failed to parse sort JSON', e);
        throw new BadRequestException('Invalid JSON format for sort parameter. Expected ["field", "order"].');
      }
    }

    
    if (rawParams.range && typeof rawParams.range === 'string') {
      try {
        const rangeArray = JSON.parse(rawParams.range);
        if (Array.isArray(rangeArray) && rangeArray.length === 2 && typeof rangeArray[0] === 'number' && typeof rangeArray[1] === 'number') {
          parsed.range = rangeArray as [number, number]; 
          parsed.start = rangeArray[0]; 
          parsed.end = rangeArray[1];   
        } else {
           throw new Error('Range array format incorrect');
        }
      } catch (e) {
        console.error('Pipe Error: Failed to parse range JSON', e);
        throw new BadRequestException('Invalid JSON format for range parameter. Expected [start, end].');
      }
    }
    return parsed;
  }
}