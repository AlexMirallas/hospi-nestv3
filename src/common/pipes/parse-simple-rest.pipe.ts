import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';

// Define your SimpleRestParams type clearly
export interface SimpleRestParams {
  filters: Record<string, any>; // Parsed filter object
  sort?: string;                // Sort field
  order?: 'ASC' | 'DESC';       // Sort order
  start?: number;               // Pagination start
  end?: number;                 // Pagination end
  range?: [number, number];     // Optional: keep original range array
}


@Injectable()
export class ParseSimpleRestParamsPipe implements PipeTransform<any, SimpleRestParams> {
  transform(rawParams: any, metadata: ArgumentMetadata): SimpleRestParams {
    // Log the raw input received by the pipe
    console.log('Pipe received rawParams:', JSON.stringify(rawParams, null, 2));

    if (!rawParams || typeof rawParams !== 'object') {
      // Handle cases where no query params are provided or input isn't an object
       return { filters: {}, sort: undefined, order: 'ASC', start: 0, end: 9 }; // Return defaults
    }

    // Initialize the object we will return, conforming to SimpleRestParams
    const parsed: SimpleRestParams = {
        filters: {},
        sort: undefined,
        order: 'ASC', // Default order
        start: 0,     // Default start
        end: 9,       // Default end (adjust as needed)
    };

    // 1. Parse Filter
    if (rawParams.filter && typeof rawParams.filter === 'string') {
      try {
        parsed.filters = JSON.parse(rawParams.filter); // Assign parsed object to filters property
      } catch (e) {
        console.error('Pipe Error: Failed to parse filter JSON', e);
        throw new BadRequestException('Invalid JSON format for filter parameter');
      }
    }

    // 2. Parse Sort
    if (rawParams.sort && typeof rawParams.sort === 'string') {
      try {
        const sortArray = JSON.parse(rawParams.sort);
        if (Array.isArray(sortArray) && sortArray.length === 2 && typeof sortArray[0] === 'string' && typeof sortArray[1] === 'string') {
          parsed.sort = sortArray[0]; // Assign to sort property
          parsed.order = sortArray[1].toUpperCase() as 'ASC' | 'DESC'; // Assign to order property
        } else {
          throw new Error('Sort array format incorrect');
        }
      } catch (e) {
         console.error('Pipe Error: Failed to parse sort JSON', e);
        throw new BadRequestException('Invalid JSON format for sort parameter. Expected ["field", "order"].');
      }
    }

    // 3. Parse Range
    if (rawParams.range && typeof rawParams.range === 'string') {
      try {
        const rangeArray = JSON.parse(rawParams.range);
        if (Array.isArray(rangeArray) && rangeArray.length === 2 && typeof rangeArray[0] === 'number' && typeof rangeArray[1] === 'number') {
          parsed.range = rangeArray as [number, number]; // Assign to range property (optional)
          parsed.start = rangeArray[0]; // Assign to start property
          parsed.end = rangeArray[1];   // Assign to end property
        } else {
           throw new Error('Range array format incorrect');
        }
      } catch (e) {
        console.error('Pipe Error: Failed to parse range JSON', e);
        throw new BadRequestException('Invalid JSON format for range parameter. Expected [start, end].');
      }
    }

    // Log the final parsed object just before returning
    console.log('Pipe is returning parsed params:', JSON.stringify(parsed, null, 2));

    // Return the *newly constructed object* with parsed values
    return parsed;
  }
}