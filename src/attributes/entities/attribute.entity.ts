import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Index, CreateDateColumn,JoinColumn, UpdateDateColumn, ManyToMany, ManyToOne } from 'typeorm';
import { AttributeValue } from '../entities/attribute-value.entity';
import { Client } from 'src/clients/entities/client.entity';
0
@Entity('attributes')
export class Attribute {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: false })
  position: number; 

  @Column({ type: 'varchar', length: 100, })
  name: string; // e.g., 'Color', 'Size'

  @OneToMany(() => AttributeValue, (value) => value.attribute)
  values: AttributeValue[];

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'client_id', type: 'uuid', nullable: true })
  clientId: string;
  
  @ManyToOne(()=> Client, client => client.attributes)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}