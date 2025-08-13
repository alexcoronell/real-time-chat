/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Column,
  OneToMany,
} from 'typeorm';

import { Department } from '@user/enums/department.enum';

import { Message } from '@message/entities/message.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', unique: true })
  nickname: string;

  @Column({
    type: 'enum',
    enum: Department,
    nullable: true, // Opcional: para permitir usuarios sin departamento
  })
  department: Department;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @OneToMany(() => Message, (message) => message.sender)
  messages: Message[];
}
