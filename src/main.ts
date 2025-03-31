import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, ValidationPipe, } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// import { JwtAuthGuard } from './common/guards/jwt-auth.guard'; // Import if setting globally
// import { RolesGuard } from './common/guards/roles.guard'; // Import if setting globally

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS (configure appropriately for production)
  app.enableCors();

  // Global Pipes for Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not in DTO
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      transform: true, // Automatically transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Allow basic type conversions
      },
    }),
  );

  // Global Interceptor for Class Serializer (works with @Exclude(), @Expose())
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // ---- Optional: Global Guards ----
  // If you want ALL endpoints to require JWT by default:
  // const reflector = app.get(Reflector);
  // app.useGlobalGuards(new JwtAuthGuard(reflector));
  // app.useGlobalGuards(new RolesGuard(reflector)); // RolesGuard needs JwtAuthGuard to run first
  // Note: Using global guards might interfere with public routes (like login).
  // It's often better to apply guards per-controller or per-route.

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000; // Example PORT from .env

  await app.listen(port);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
