import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index, ManyToMany, JoinColumn } from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { ProductVariant } from './product-variant.entity'; 
import { Client } from 'src/clients/entities/client.entity';

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
  basePrice: number; 

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;


  @ManyToMany(() => Category, (category) => category.products)
  categories: Category[];

  @Column({ name: 'client_id', type: 'uuid', nullable: true })
  clientId: string;

  @ManyToMany(()=> Client, client => client.products)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  
  @OneToMany(() => ProductVariant, variant => variant.product, {
  cascade: true
  })
  variants: ProductVariant[];
}