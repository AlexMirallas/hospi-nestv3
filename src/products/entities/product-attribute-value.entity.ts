import { 
    Entity, 
    PrimaryGeneratedColumn, 
    ManyToOne, 
    CreateDateColumn, 
    UpdateDateColumn,
    JoinColumn,
    Index,
    Unique
  } from 'typeorm';
  import { ProductVariant } from './product-variant.entity';
  import { AttributeValue } from '../../attributes/entities/attribute-value.entity';
  import { Attribute } from '../../attributes/entities/attribute.entity';
  
  @Entity('product_attribute_values')
  @Unique(['variant', 'attribute']) // Ensures only one value per attribute per variant god bless
  export class ProductAttributeValue {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @ManyToOne(() => ProductVariant, variant => variant.attributeValues, {
      nullable: false,
      onDelete: 'CASCADE',
      orphanedRowAction: 'delete',
    })
    @JoinColumn({ name: 'variant_id' })
    variant: ProductVariant;
  
    @ManyToOne(() => AttributeValue, { nullable: false, eager: false })
    @JoinColumn({ name: 'attribute_value_id' })
    @Index()
    attributeValue: AttributeValue;
  
    @ManyToOne(() => Attribute, { nullable: false, eager: false })
    @JoinColumn({ name: 'attribute_id' })
    @Index()
    attribute: Attribute;
  
    @CreateDateColumn()
    createdAt: Date;
  
    @UpdateDateColumn()
    updatedAt: Date;
  }