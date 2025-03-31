import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn,OneToMany, } from 'typeorm';
import { Attribute } from './attribute.entity';
import { ProductAttribute } from '../../products/entities/product-attribute.entity';
import { IsHexColor, IsOptional } from 'class-validator';

@Entity('attribute_values')
export class AttributeValue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  value: string; // e.g., 'Red', 'XL'

  @Column({ type: 'varchar', length: 7, nullable: true }) // e.g., #FF0000
  @IsOptional() // Make it optional at the entity level
  @IsHexColor() // Validate format if present
  hexCode: string | null;

  @ManyToOne(() => Attribute, (attribute) => attribute.values, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attribute_id' }) // Explicitly define foreign key column name
  attribute: Attribute;

  @Column({ name: 'attribute_id' }) // Store the foreign key ID
  attributeId: number;

  @OneToMany(() => ProductAttribute, (pa) => pa.attributeValue)
  productAttributes: ProductAttribute[]; // Link to join table

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  isColorAttribute(): boolean {
    // Ensure attribute is loaded and name exists before checking
    return this.attribute && this.attribute.name?.toLowerCase() === 'color';
  }
}