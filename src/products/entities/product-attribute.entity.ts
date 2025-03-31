import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn, Index } from 'typeorm';
import { Product } from './product.entity';
import { AttributeValue } from '../../attributes/entities/attribute-value.entity';

@Entity('product_attributes')
export class ProductAttribute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Product, (product) => product.attributeCombinations, { 
    nullable: false, 
    onDelete: 'CASCADE' 
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => AttributeValue, (value) => value.productAttributes, { 
    nullable: false, 
    onDelete: 'RESTRICT'
  })
  @JoinColumn({ name: 'attribute_value_id' })
  attributeValue: AttributeValue;

  // Variant specific overrides
  @Column({ type: 'varchar', length: 255, nullable: true })
  variantSku: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  priceAdjustment: number;

  @Column({ type: 'int', nullable: true })
  stockQuantity: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'uuid', name: 'combination_id', nullable: true })
  @Index()
  combinationId: string;
}