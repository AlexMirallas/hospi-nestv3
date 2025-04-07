import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
  } from '@nestjs/common';
  import { Observable } from 'rxjs';
  import { map } from 'rxjs/operators';
  import { Request, Response } from 'express'; // Or from 'fastify' if you use that
  
  export interface PaginatedResponse<T> {
    data: T[];
    total: number;
  }
  
  @Injectable()
  export class SimpleRestContentRangeInterceptor<T> implements NestInterceptor<PaginatedResponse<T>, T[]> {
    intercept(context: ExecutionContext, next: CallHandler): Observable<T[]> {
      const httpContext = context.switchToHttp();
      const request = httpContext.getRequest<Request>();
      const response = httpContext.getResponse<Response>();
  
      return next.handle().pipe(
        map((result: PaginatedResponse<T> | T[]) => {
          // Check if the result is in our expected paginated format
          // Some endpoints might just return an array, interceptor should ignore those
          if (result && typeof result === 'object' && 'data' in result && 'total' in result && Array.isArray(result.data) && typeof result.total === 'number') {
            const { data, total } = result;
  
            // Extract pagination params from request query (adjust keys if needed)
            // Assuming your SimpleRestParams uses 'start' and 'end'
            const reqQuery = request.query;
            const start = parseInt(reqQuery.start as string || reqQuery._start as string || '0', 10);
            // Calculate 'end' based on data length and start, as the DTO might have different names (_end vs end)
            const end = start + data.length - 1;
  
            // Attempt to get resource name from path (e.g., /variants -> variants)
            // This is a basic attempt, might need adjustment for complex routing
            const resourceName = request.path.split('/')[1] || 'items'; // Use 'items' as fallback
  
            // Set Content-Range header
            const contentRange = `${resourceName} ${start}-${end}/${total}`;
            response.header('Content-Range', contentRange);
  
            // Expose the header for CORS if necessary (see note below)
            const currentExposedHeaders = response.getHeader('Access-Control-Expose-Headers') || '';
            if (!String(currentExposedHeaders).split(',').map(h => h.trim()).includes('Content-Range')) {
               response.header('Access-Control-Expose-Headers', `${currentExposedHeaders ? currentExposedHeaders + ', ' : ''}Content-Range`);
            }
  
            // Return only the data array in the response body
            return data;
          }
  
          // If result is not in PaginatedResponse format, pass it through unchanged
          // This handles cases where the endpoint returns just an array or a single object
          return result as T[]; 
        }),
      );
    }
  }