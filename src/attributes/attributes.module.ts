import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttributesService, AttributeValuesService } from './attributes.service';
import { AttributesController, AttributeValuesController } from './attributes.controller';
import { Attribute } from './entities/attribute.entity';
import { AttributeValue } from './entities/attribute-value.entity';
import { AttributeRepository } from './repositories/attribute.repository';
import { AttributeValueRepository } from './repositories/attribute-value.repository';

@Module({
  imports: [
      TypeOrmModule.forFeature([
          Attribute,
          AttributeValue
      ])
  ],
  controllers: [AttributesController, AttributeValuesController],
  providers: [AttributesService, AttributeValuesService,AttributeRepository,AttributeValueRepository],
  exports: [AttributesService, AttributeValuesService, TypeOrmModule.forFeature([Attribute])],
})
export class AttributesModule {}
