import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    BeforeInsert,
    BeforeUpdate,
    Index,
    ManyToOne,
    JoinColumn,
  } from 'typeorm';
  import { Role } from '../../common/enums/role.enum';
  import * as bcrypt from 'bcrypt';
  import { Exclude } from 'class-transformer'; 
import { Client } from 'src/clients/entities/client.entity';
  
  @Entity('users')
  export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Index({ unique: true })
    @Column({ type: 'varchar', length: 255, unique: true })
    email: string;
  
    @Exclude() // Exclude password from responses by default
    @Column({ type: 'varchar', length: 255 })
    password: string;
  
    @Column({ type: 'varchar', length: 100 })
    firstName: string;
  
    @Column({ type: 'varchar', length: 100 })
    lastName: string;
  
    @Column({ type: 'varchar', length: 20, nullable: true })
    phone: string;
  
    @Column({
      type: 'enum',
      enum: Role,
      array: true, 
      default: [Role.SuperAdmin],
    })
    roles: Role[];
    
    @Column({name: 'client_id', type: 'uuid', nullable: true})
    clientId: string;
    
    @ManyToOne(()=> Client, client => client.users)
    @JoinColumn({ name: 'client_id' })
    client: Client;

    @CreateDateColumn()
    createdAt: Date;
  
    @UpdateDateColumn()
    updatedAt: Date;
  
    @BeforeInsert()
    @BeforeUpdate()
    async hashPassword() {
      if (this.password) {
        const salt = await bcrypt.genSalt();
        this.password = await bcrypt.hash(this.password, salt);
      }
    }
  
    // Method to compare passwords (used in AuthService)
    async validatePassword(password: string): Promise<boolean> {
      return bcrypt.compare(password, this.password);
    }
  }