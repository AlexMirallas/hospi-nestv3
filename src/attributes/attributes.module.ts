import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttributesService, AttributeValuesService } from './attributes.service';
import { AttributesController, AttributeValuesController } from './attributes.controller';
import { Attribute } from './entities/attribute.entity';
import { AttributeValue } from './entities/attribute-value.entity';

@Module({
  imports: [
      TypeOrmModule.forFeature([
          Attribute, // Make Attribute repository available
          AttributeValue
      ])
  ],
  controllers: [AttributesController, AttributeValuesController],
  // Provide both services
  providers: [AttributesService, AttributeValuesService],
  // Export Attribute service if it's needed by other modules (like Product service later maybe)
  // Export Attribute repository if AttributeValuesService injects the repository directly
  exports: [AttributesService, AttributeValuesService, TypeOrmModule.forFeature([Attribute])],
})
export class AttributesModule {}
