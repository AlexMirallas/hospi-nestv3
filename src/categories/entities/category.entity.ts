import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Tree,
    TreeChildren,
    TreeParent,
    ManyToMany,
    JoinTable,
    Index,
  } from 'typeorm';
  import { Product } from '../../products/entities/product.entity';
  
  @Entity('categories')
  @Tree('materialized-path')
  export class Category {
    @PrimaryGeneratedColumn()
    id: number;
  
    @Index({ unique: true })
    @Column({ type: 'varchar', length: 255, unique: true })
    name: string;
  
    @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
    @Index()
    slug: string; 
  
    @Column({ type: 'text', nullable: true })
    description: string;
  
   
    @TreeChildren()
    children: Category[];
  
    @TreeParent({ onDelete: 'SET NULL' }) 
    parent: Category | null;
  
    
    @Column({ nullable: true })
    parentId: number | null;
    
  
  
    // --- Many-to-Many with Product ---
    @ManyToMany(() => Product, (product) => product.categories)
    @JoinTable({
      name: 'product_categories', //  junction table
      joinColumn: { 
        name: 'category_id',
        referencedColumnName: 'id',
      },
      inverseJoinColumn: { // Column for the other side (Product)
        name: 'product_id',
        referencedColumnName: 'id',
      },
    })
    products: Product[]; 
  
  
    @CreateDateColumn()
    createdAt: Date;
  
    @UpdateDateColumn()
    updatedAt: Date;
  
    // TODO: Add @BeforeInsert / @BeforeUpdate hook to generate slug from name if needed
  }