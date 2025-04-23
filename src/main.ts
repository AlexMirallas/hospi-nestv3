import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, ValidationPipe, } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors(
    {exposedHeaders: 'Content-Range',} // Expose Content-Range header for CORS
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, 
      transform: true, 
      transformOptions: {
        enableImplicitConversion: true, 
      },
    }),
  );

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector))); // 



  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000; 

  await app.listen(port);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
