import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Product } from '../../products/entities/product.entity';
import { Category } from '../../categories/entities/category.entity';
import { Attribute } from '../../attributes/entities/attribute.entity';
import { ProductVariant } from 'src/products/entities/product-variant.entity';
import { AttributeValue } from 'src/attributes/entities/attribute-value.entity';
import { Status } from 'src/common/enums/status.enum';
import { ProductAttributeValue } from 'src/products/entities/product-attribute-value.entity';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true }) 
  subdomain: string;

  @Column({ type: 'enum', default: Status.Active ,enum: Status })
  status: Status;

  @Column({ type: 'jsonb', nullable: true })
  settings: Record<string, any>; 

  @OneToMany(() => User, user => user.client)
  users: User[];

  @OneToMany(() => Product, product => product.client)
  products: Product[];

  @OneToMany(() => Category, category => category.client)
  categories: Category[];

  @OneToMany(() => Attribute, attribute => attribute.client)
  attributes: Attribute[];

  @OneToMany(()=> ProductVariant, productVariant => productVariant.client)
  productVariants: ProductVariant[];

  @OneToMany(()=> AttributeValue, attributeValue => attributeValue.client)
  attributeValues: AttributeValue[];

  @OneToMany(() => Product, product => product.client)
  productAttributeValues: ProductAttributeValue[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}