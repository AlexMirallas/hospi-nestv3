// src/users/entities/user.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    BeforeInsert,
    BeforeUpdate,
    Index,
  } from 'typeorm';
  import { Role } from '../../common/enums/role.enum';
  import * as bcrypt from 'bcrypt';
  import { Exclude } from 'class-transformer'; // Important for hiding password
  
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
      array: true, // Store roles as an array
      default: [Role.Admin],
    })
    roles: Role[];
  
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