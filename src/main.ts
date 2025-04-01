import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, ValidationPipe, } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS (configure appropriately for production)
  app.enableCors(
    {exposedHeaders: 'Content-Range',} // Expose Content-Range header for CORS
  );

  // Global Pipes for Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not in DTO
      forbidNonWhitelisted: false, // Throw error if non-whitelisted properties are present
      transform: true, // Automatically transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Allow basic type conversions
      },
    }),
  );

  // Global Interceptor for Class Serializer (works with @Exclude(), @Expose())
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector))); // 



  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000; // Example PORT from .env

  await app.listen(port);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
