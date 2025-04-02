import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index, ManyToMany } from 'typeorm';
import { ProductAttribute } from '../entities/product-attribute.entity';
import { Category } from '../../categories/entities/category.entity';
import { ProductVariant } from './product-variant.entity'; 

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  sku: string; //  Stock Keeping Unit

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.00 })
  basePrice: number; // Price of the 'base' product before variant adjustments

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // A product can have many attribute combinations (variants)
  @OneToMany(() => ProductAttribute, (productAttribute) => productAttribute.product, { cascade: ['insert', 'update'] })
  attributeCombinations: ProductAttribute[];

  @ManyToMany(() => Category, (category) => category.products)
  categories: Category[];

  
  @OneToMany(() => ProductVariant, variant => variant.product, {
  cascade: true
  })
  variants: ProductVariant[];
}