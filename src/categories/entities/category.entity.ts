// src/categories/entities/category.entity.ts
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
  @Tree('materialized-path') // Or 'closure-table' or 'nested-set'. Materialized path is often simpler.
  export class Category {
    @PrimaryGeneratedColumn()
    id: number;
  
    @Index({ unique: true })
    @Column({ type: 'varchar', length: 255, unique: true })
    name: string;
  
    @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
    @Index()
    slug: string; // URL-friendly identifier
  
    @Column({ type: 'text', nullable: true })
    description: string;
  
    // --- Self-referencing for Hierarchy ---
    @TreeChildren()
    children: Category[];
  
    @TreeParent({ onDelete: 'SET NULL' }) // If parent is deleted, children become top-level
    parent: Category | null;
  
    // Store parentId explicitly if needed for easier querying without loading the full parent object
    @Column({ nullable: true })
    parentId: number | null;
    // --- End Hierarchy ---
  
  
    // --- Many-to-Many with Product ---
    @ManyToMany(() => Product, (product) => product.categories)
    // Define the join table details (optional but recommended for clarity)
    // TypeORM default would be category_products_product
    @JoinTable({
      name: 'product_categories', // Explicitly name the junction table
      joinColumn: { // Column for the owning side (Category)
        name: 'category_id',
        referencedColumnName: 'id',
      },
      inverseJoinColumn: { // Column for the other side (Product)
        name: 'product_id',
        referencedColumnName: 'id',
      },
    })
    products: Product[]; // Relation defined here
    // --- End Many-to-Many ---
  
    @CreateDateColumn()
    createdAt: Date;
  
    @UpdateDateColumn()
    updatedAt: Date;
  
    // TODO: Add @BeforeInsert / @BeforeUpdate hook to generate slug from name if needed
  }