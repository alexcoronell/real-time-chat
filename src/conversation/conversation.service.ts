/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import { Conversation } from './entities/conversation.entity';
import { User } from '@user/entities/user.entity';
import { CreateConversationDto } from './dtos/create-conversation.dto';

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(Conversation)
    private conversationsRepository: Repository<Conversation>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findOrCreate(dto: CreateConversationDto): Promise<Conversation> {
    const { participantIds } = dto;

    // Validar que haya al menos dos participantes
    if (participantIds.length < 2) {
      throw new Error('A conversation must have at least two participants.');
    }

    // Buscar los usuarios por sus IDs
    const participants = await this.usersRepository.find({
      where: { id: In(participantIds) },
    });

    // Validar que se encontraron todos los usuarios
    if (participants.length !== participantIds.length) {
      throw new NotFoundException('One or more participants not found.');
    }

    // La lógica de la conversación grupal se mantiene igual
    const sortedParticipantIds = participants.map((user) => user.id).sort();

    const conversation = await this.conversationsRepository
      .createQueryBuilder('conversation')
      .leftJoin('conversation.participants', 'user')
      .where('user.id IN (:...participantIds)', {
        participantIds: sortedParticipantIds,
      })
      .groupBy('conversation.id')
      .having('COUNT(user.id) = :count', { count: sortedParticipantIds.length })
      .getOne();

    if (!conversation) {
      const newConversation = this.conversationsRepository.create({
        participants,
      });
      await this.conversationsRepository.save(newConversation);
      return newConversation;
    }

    return conversation;
  }

  async getMessages(conversationId: number) {
    const conversation = await this.conversationsRepository.findOne({
      where: { id: conversationId },
      relations: ['messages', 'messages.sender'],
    });
    return conversation?.messages || [];
  }
}
