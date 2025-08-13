import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import { MessageStatus } from './entities/message-status.entity';

import { CreateMessageStatusDto } from './dto/create-message-status.dto';

@Injectable()
export class MessageStatusService {
  constructor(
    @InjectRepository(MessageStatus)
    private readonly repo: Repository<MessageStatus>,
  ) {}

  async createMessageStatuses(dto: CreateMessageStatusDto) {
    const { usersId, messageId, conversationId } = dto;
    const statuses = usersId.map((userId) =>
      this.repo.create({
        message: { id: messageId },
        user: { id: userId },
        conversation: { id: conversationId },
        isRead: false,
      }),
    );
    return this.repo.save(statuses);
  }

  async markAsRead(userId: number, conversationId: number) {
    await this.repo
      .createQueryBuilder()
      .update(MessageStatus)
      .set({ isRead: true })
      .where('userId = :userId', { userId })
      .andWhere('conversationId = :conversationId', { conversationId })
      .andWhere('isRead = :isRead', { isRead: false })
      .execute();
  }

  async countUnreadMessages(
    userId: number,
    conversationId: number,
  ): Promise<number> {
    const count = await this.repo.count({
      where: {
        user: { id: userId },
        conversation: { id: conversationId },
        isRead: false,
      },
    });
    return count;
  }
}
