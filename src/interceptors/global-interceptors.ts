import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
  } from '@nestjs/common';
  import { Observable } from 'rxjs';
  import { map } from 'rxjs/operators';
  import { Request, Response } from 'express'; 
  
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

          if (result && typeof result === 'object' && 'data' in result && 'total' in result && Array.isArray(result.data) && typeof result.total === 'number') {
            const { data, total } = result;
  
            const reqQuery = request.query;
            const start = parseInt(reqQuery.start as string || reqQuery._start as string || '0', 10);
            
            const end = start + data.length - 1;
  
           
            const resourceName = request.path.split('/')[1] || 'items'; 
  
          
            const contentRange = `${resourceName} ${start}-${end}/${total}`;
            response.header('Content-Range', contentRange);
  
            const currentExposedHeaders = response.getHeader('Access-Control-Expose-Headers') || '';
            if (!String(currentExposedHeaders).split(',').map(h => h.trim()).includes('Content-Range')) {
               response.header('Access-Control-Expose-Headers', `${currentExposedHeaders ? currentExposedHeaders + ', ' : ''}Content-Range`);
            }
  
            return data;
          }
  
          return result as T[]; 
        }),
      );
    }
  }