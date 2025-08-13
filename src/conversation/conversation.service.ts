/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/* Services */
import { UserService } from '@user/user.service';

/* Entities */
import { Conversation } from './entities/conversation.entity';
import { User } from '@user/entities/user.entity';

/* DTO's */
import { CreateConversationDto } from './dtos/create-conversation.dto';

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(Conversation)
    private repo: Repository<Conversation>,
    private userService: UserService,
  ) {}

  async findOrCreate(dto: CreateConversationDto): Promise<Conversation> {
    const { participantIds } = dto;

    // Validar que haya al menos dos participantes
    if (participantIds.length < 2) {
      throw new Error('A conversation must have at least two participants.');
    }

    // Buscar los usuarios por sus IDs
    const participants = await this.userService.findAllById(participantIds);

    // Validar que se encontraron todos los usuarios
    if (participants.length !== participantIds.length) {
      throw new NotFoundException('One or more participants not found.');
    }

    // La lógica de la conversación grupal se mantiene igual
    const sortedParticipantIds = participants.map((user) => user.id).sort();

    const conversation = await this.repo
      .createQueryBuilder('conversation')
      .leftJoin('conversation.participants', 'user')
      .where('user.id IN (:...participantIds)', {
        participantIds: sortedParticipantIds,
      })
      .groupBy('conversation.id')
      .having('COUNT(user.id) = :count', { count: sortedParticipantIds.length })
      .getOne();

    if (!conversation) {
      const newConversation = this.repo.create({
        participants,
      });
      await this.repo.save(newConversation);
      return newConversation;
    }

    return conversation;
  }

  async findOneById(id: number) {
    const conversation = await this.repo.findOneBy({ id });
    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${id} not found.`);
    }
    return conversation;
  }

  async getMessages(id: number) {
    const conversation = await this.repo.findOne({
      where: { id },
      relations: ['messages', 'messages.sender'],
    });
    return conversation?.messages || [];
  }

  async getParticipants(conversationId: number): Promise<User[]> {
    const conversation = await this.repo.findOne({
      where: { id: conversationId },
      relations: ['participants'],
    });

    if (!conversation) {
      throw new NotFoundException(
        `Conversation with ID ${conversationId} not found.`,
      );
    }

    return conversation.participants;
  }
}
