import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn, Index } from 'typeorm';
import { Product } from './product.entity';
import { AttributeValue } from '../../attributes/entities/attribute-value.entity';

@Entity('product_attributes') // Represents a specific product variant/combination
@Index(['productId', 'attributeValueId'], { unique: true }) // A product can only have a specific attribute value once per combo concept (might need adjustment based on exact variant logic)
export class ProductAttribute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Product, (product) => product.attributeCombinations, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'product_id' })
  productId: string;

  @ManyToOne(() => AttributeValue, (value) => value.productAttributes, { nullable: false, onDelete: 'RESTRICT', eager: true }) // Eager load value details
  @JoinColumn({ name: 'attribute_value_id' })
  attributeValue: AttributeValue;

  @Column({ name: 'attribute_value_id' })
  attributeValueId: number;

  // Variant specific overrides
  @Column({ type: 'varchar', length: 255, nullable: true })
  variantSku: string; // Specific SKU for this variant (e.g., BASE_SKU-RED-XL)

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  priceAdjustment: number; // e.g., +5.00 for XL, -2.00 for Small

  @Column({ type: 'int', nullable: true })
  stockQuantity: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Potentially add combination group identifier if multiple attributes define one variant (e.g., Red + XL is one variant)
  @Column({ type: 'uuid', name: 'combination_id', nullable: true })
  @Index()
  combinationId: string;
}