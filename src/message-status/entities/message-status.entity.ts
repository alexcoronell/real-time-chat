/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  JoinColumn,
} from 'typeorm';

import { Conversation } from '@conversation/entities/conversation.entity';
import { Message } from '@message/entities/message.entity';
import { User } from '@user/entities/user.entity';

@Entity('message_status')
export class MessageStatus {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Conversation, (conversation) => conversation.statuses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @ManyToOne(() => Message, (message) => message.statuses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'message_id' })
  message: Message;

  @ManyToOne(() => User, (user) => user.statuses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;
}
