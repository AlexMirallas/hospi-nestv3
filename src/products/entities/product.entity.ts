import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index, ManyToMany, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { ProductVariant } from './product-variant.entity'; 
import { Client } from 'src/clients/entities/client.entity';
import { ProductImage } from './image.entity';

@Entity('products')
@Unique(['clientId', 'sku'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, })
  sku: string; 

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.00 })
  basePrice: number; 

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  initialStock: number;

  @Column({ type: 'boolean', default: true })
  trackInventory: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;


  @ManyToMany(() => Category, (category) => category.products)
  categories: Category[];

  @Column({ name: 'client_id', type: 'uuid', nullable: true })
  clientId: string;

  @ManyToOne(()=> Client, client => client.products)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  
  @OneToMany(() => ProductVariant, variant => variant.product, {
  cascade: true
  })
  variants: ProductVariant[];

  @OneToMany(() => ProductImage, (image) => image.product, { cascade: true })
  images: ProductImage[];

}