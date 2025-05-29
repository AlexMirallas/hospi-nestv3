import { Module } from '@nestjs/common';
import { join } from 'path';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/modules/products.module';
import { AttributesModule } from './attributes/attributes.module';
import { User } from './users/entities/user.entity';
import { Product } from './products/entities/product.entity';
import { Category } from './categories/entities/category.entity';
import { Attribute } from './attributes/entities/attribute.entity';
import { AttributeValue } from './attributes/entities/attribute-value.entity';
import { CategoriesModule } from './categories/categories.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductVariant } from './products/entities/product-variant.entity';
import { ClsModule } from 'nestjs-cls'; 
import { Client } from './clients/entities/client.entity';
import { StockModule } from './stock/stock.module';
import { StockMovement } from './stock/entities/stock-movement.entity';
import { StockLevel } from './stock/entities/stock-level.entity';

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true }, 
    }),
    ConfigModule.forRoot({
      isGlobal: true, 
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DATABASE_HOST'),
        port: configService.get<number>('DATABASE_PORT'),
        username: configService.get<string>('DATABASE_USERNAME'),
        password: configService.get<string>('DATABASE_PASSWORD'),
        database: configService.get<string>('DATABASE_NAME'),
        entities: [User, Product, Attribute, AttributeValue, Category, ProductVariant, Client,StockLevel, StockMovement], 
        synchronize: true, 
        autoLoadEntities: true,
      }),
      inject: [ConfigService],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads'
      }),
    AuthModule,
    UsersModule,
    ProductsModule,
    AttributesModule,
    CategoriesModule,
    StockModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
