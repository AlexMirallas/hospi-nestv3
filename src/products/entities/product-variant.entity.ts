import { 
    Entity, 
    PrimaryGeneratedColumn, 
    Column, 
    ManyToOne, 
    OneToMany,
    ManyToMany, 
    CreateDateColumn, 
    UpdateDateColumn,
    JoinColumn,
    Index,
    Unique
  } from 'typeorm';
  import { Product } from './product.entity';
  import { ProductAttributeValue } from './product-attribute-value.entity';
  import { Client } from 'src/clients/entities/client.entity';
  import { ProductImage } from './image.entity'; 

  
  @Entity('product_variants')
  @Unique(['clientId', 'sku']) 
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
    initialStock: number;
  
    @Column({ type: 'boolean', default: true })
    isActive: boolean;
  
    @OneToMany(() => ProductAttributeValue, attrValue => attrValue.variant, {
      cascade: ['insert', 'update'],
      onDelete: 'CASCADE'
    })
    attributeValues: ProductAttributeValue[];

    @Column({ name: 'client_id', type: 'uuid', nullable: true })
    clientId: string;
    
    @ManyToOne(()=> Client, client => client.productVariants)
    @JoinColumn({ name: 'client_id' })
    client: Client;
  
    @CreateDateColumn()
    createdAt: Date;
  
    @UpdateDateColumn()
    updatedAt: Date;

    @OneToMany(() => ProductImage, (image) => image.variant, { cascade: true })
    images: ProductImage[];
  }