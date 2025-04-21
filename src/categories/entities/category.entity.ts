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
    JoinColumn,
    ManyToOne,
  } from 'typeorm';
  import { Product } from '../../products/entities/product.entity';
  import { Client } from 'src/clients/entities/client.entity';
  
  @Entity('categories')
  @Tree('materialized-path')
  export class Category {
    @PrimaryGeneratedColumn()
    id: number;
  

    @Column({ type: 'varchar', length: 255, nullable: false })
    name: string;
  
    @Column({ type: 'varchar', length: 255, nullable: true })
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
    
    @ManyToMany(() => Product, (product) => product.categories)
    @JoinTable({
      name: 'product_categories',
      joinColumn: { 
        name: 'category_id',
        referencedColumnName: 'id',
      },
      inverseJoinColumn: { 
        name: 'product_id',
        referencedColumnName: 'id',
      },
    })
    products: Product[]; 
    
    @Column({ name: 'client_id', type: 'uuid', nullable: true })
    clientId: string;
    
    @ManyToOne(()=> Client, client => client.categories)
    @JoinColumn({ name: 'client_id' })
    client: Client;
  
    @CreateDateColumn()
    createdAt: Date;
  
    @UpdateDateColumn()
    updatedAt: Date;
  
  }