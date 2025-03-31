import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { AttributeValue } from '../entities/attribute-value.entity';
0
@Entity('attributes')
export class Attribute {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: false })
  position: number; 

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, unique: true })
  name: string; // e.g., 'Color', 'Size'

  @OneToMany(() => AttributeValue, (value) => value.attribute)
  values: AttributeValue[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}