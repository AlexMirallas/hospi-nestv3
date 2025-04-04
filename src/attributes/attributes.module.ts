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
  providers: [AttributesService, AttributeValuesService],
  exports: [AttributesService, AttributeValuesService, TypeOrmModule.forFeature([Attribute])],
})
export class AttributesModule {}
