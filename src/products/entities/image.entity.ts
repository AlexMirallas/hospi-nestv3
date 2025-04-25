import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn,
    Index,
  } from 'typeorm';
  import { Product } from './product.entity';
  import { ProductVariant } from './product-variant.entity';
  import { Client } from '../../clients/entities/client.entity'; // Adjust path if needed
  
  @Entity('product_images')
  export class ProductImage {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column()
    filename: string; // Name of the file stored on disk (e.g., uuid.jpg)
  
    @Column()
    path: string; // Relative path to the file (e.g., uploads/products/client-uuid/uuid.jpg)
  
    @Column({ nullable: true })
    originalFilename?: string; // Original name of the uploaded file
  
    @Column({ nullable: true })
    mimetype?: string; // Mime type (e.g., image/jpeg)
  
    @Column({ nullable: true })
    altText?: string; // Alt text for accessibility
  
    @Column({ default: 0 })
    displayOrder: number; // To control image order
  
    @Column({ default: false })
    isPrimary: boolean; // Flag for the main image
  
    // --- Relationships ---
  
    @ManyToOne(() => Product, (product) => product.images, {
      nullable: true,
      onDelete: 'CASCADE', // Delete image record if product is deleted
    })
    @JoinColumn({ name: 'product_id' })
    @Index()
    product?: Product;
  
    @Column({ type: 'uuid', name: 'product_id', nullable: true })
    productId?: string;
  
    @ManyToOne(() => ProductVariant, (variant) => variant.images, {
      nullable: true,
      onDelete: 'CASCADE', 
    })
    @JoinColumn({ name: 'variant_id' })
    @Index()
    variant?: ProductVariant;
  
    @Column({ type: 'uuid', name: 'variant_id', nullable: true })
    variantId?: string;
  
    @ManyToOne(() => Client, (client) => client.productImages, { nullable: false })
    @JoinColumn({ name: 'client_id' })
    @Index()
    client: Client;
  
    @Column({ type: 'uuid', name: 'client_id' })
    clientId: string;
  
    @CreateDateColumn()
    createdAt: Date;
  
    @UpdateDateColumn()
    updatedAt: Date;
  }