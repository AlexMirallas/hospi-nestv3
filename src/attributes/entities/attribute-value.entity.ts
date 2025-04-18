import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn,ManyToMany, UpdateDateColumn, JoinColumn,OneToMany, } from 'typeorm';
import { Attribute } from './attribute.entity';
import { IsHexColor, IsOptional } from 'class-validator';
import { Client } from 'src/clients/entities/client.entity';

@Entity('attribute_values')
export class AttributeValue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: false })
  position: number; 

  @Column({ type: 'varchar', length: 100 })
  value: string;

  @Column({ type: 'varchar', length: 7, nullable: true }) 
  @IsOptional() 
  @IsHexColor() 
  hexCode: string | null;

  @ManyToOne(() => Attribute, (attribute) => attribute.values, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attribute_id' }) 
  attribute: Attribute;

  @Column({ name: 'attribute_id' }) 
  attributeId: number;

  @Column({ name: 'client_id', type: 'uuid', nullable: true })
  clientId: string;
  
  @ManyToOne(()=> Client, client => client.attributeValues)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  isColorAttribute(): boolean {
    return this.attribute && this.attribute.name?.toLowerCase() === 'couleur';
  }
}