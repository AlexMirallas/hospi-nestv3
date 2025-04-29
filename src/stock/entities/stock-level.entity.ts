import { Entity, PrimaryGeneratedColumn, Column, Index, ManyToOne, JoinColumn, Unique, Check, UpdateDateColumn } from 'typeorm';
import { Client } from '../../clients/entities/client.entity'; 
import { Product } from '../../products/entities/product.entity'; 
import { ProductVariant } from '../../products/entities/product-variant.entity';

@Entity('stock_levels')
@Unique(['productId', 'clientId'])
@Unique(['variantId', 'clientId'])
@Check(`"product_id" IS NOT NULL OR "variant_id" IS NOT NULL`)
@Check(`NOT ("product_id" IS NOT NULL AND "variant_id" IS NOT NULL)`)
export class StockLevel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Product, { nullable: true, onDelete: 'CASCADE' }) 
  @JoinColumn({ name: 'product_id' })
  @Index()
  product?: Product;

  @Column({ type: 'uuid', name: 'product_id', nullable: true })
  productId?: string;

  @ManyToOne(() => ProductVariant, { nullable: true, onDelete: 'CASCADE' }) 
  @Index()
  variant?: ProductVariant;

  @Column({ type: 'uuid', name: 'variant_id', nullable: true })
  variantId?: string;


  @Column({ type: 'int', default: 0 })
  quantity: number; 

  @ManyToOne(() => Client, { nullable: false })
  @JoinColumn({ name: 'client_id' })
  @Index()
  client: Client;

  @Column({ type: 'uuid', name: 'client_id' })
  clientId: string;

  @UpdateDateColumn()
  updatedAt: Date;
}