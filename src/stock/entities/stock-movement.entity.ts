import { Entity, PrimaryGeneratedColumn, Column, Index, ManyToOne, JoinColumn, CreateDateColumn, Check } from 'typeorm';
import { Client } from '../../clients/entities/client.entity'; 
import { Product } from '../../products/entities/product.entity'; 
import { ProductVariant } from '../../products/entities/product-variant.entity'; 
import { User } from '../../users/entities/user.entity';
import { StockMovementType } from '../../common/enums/stock-movement.enum';




@Entity('stock_movements')
@Check(`"product_id" IS NOT NULL OR "variant_id" IS NOT NULL`)
@Check(`NOT ("product_id" IS NOT NULL AND "variant_id" IS NOT NULL)`)
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Product, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  @Index()
  product?: Product;

  @Column({ type: 'uuid', name: 'product_id', nullable: true })
  productId?: string;

  @ManyToOne(() => ProductVariant, { nullable: true, onDelete: 'CASCADE' }) 
  @JoinColumn({ name: 'variant_id' })
  @Index()
  variant?: ProductVariant;

  @Column({ type: 'uuid', name: 'variant_id', nullable: true })
  variantId?: string;


  @Column({ type: 'int' })
  quantityChange: number; 

  @Column({
    type: 'enum',
    enum: StockMovementType,
  })
  movementType: StockMovementType;

  @Column({ type: 'text', nullable: true })
  reason?: string; 

  @Column({ nullable: true })
  sourceDocumentId?: string; 

  @Column({ nullable: true })
  sourceDocumentType?: string; 

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' }) 
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId?: string;

  @ManyToOne(() => Client, { nullable: false })
  @JoinColumn({ name: 'client_id' })
  @Index()
  client: Client;

  @Column({ type: 'uuid', name: 'client_id' })
  clientId: string;

  @CreateDateColumn()
  movementDate: Date; 
}
