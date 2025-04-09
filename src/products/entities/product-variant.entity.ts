import { 
    Entity, 
    PrimaryGeneratedColumn, 
    Column, 
    ManyToOne, 
    OneToMany, 
    CreateDateColumn, 
    UpdateDateColumn,
    JoinColumn,
    Index,
    Unique
  } from 'typeorm';
  import { Product } from './product.entity';
  import { ProductAttributeValue } from './product-attribute-value.entity';
  
  @Entity('product_variants')
  @Unique(['product', 'sku']) // Ensure SKU is unique within a product
  export class ProductVariant {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column({ type: 'varchar', length: 255 })
    sku: string;
  
    @ManyToOne(() => Product, product => product.variants, { 
      nullable: false, 
      onDelete: 'CASCADE' 
    })
    @JoinColumn({ name: 'product_id' })
    @Index()
    product: Product;
  
    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    priceAdjustment: number;
  
    @Column({ type: 'int', default: 0 })
    stockQuantity: number;
  
    @Column({ type: 'boolean', default: true })
    isActive: boolean;
  
    @OneToMany(() => ProductAttributeValue, attrValue => attrValue.variant, {
      cascade: ['insert', 'update'],
      onDelete: 'CASCADE'
    })
    attributeValues: ProductAttributeValue[];
  
    @CreateDateColumn()
    createdAt: Date;
  
    @UpdateDateColumn()
    updatedAt: Date;
  }