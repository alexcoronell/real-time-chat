/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/* Services */
import { UserService } from '@user/user.service';
import { ConversationService } from '@conversation/conversation.service';

/* Entities */
import { Message } from './entities/message.entity';

/* DTO's */
import { CreateMessageDto } from './dtos/create-message.dto';

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private messagesRepository: Repository<Message>,
    private conversationService: ConversationService,
    private userService: UserService,
  ) {}

  async create(dto: CreateMessageDto): Promise<Message> {
    const { senderNickname, conversationId, content } = dto;

    const sender = await this.userService.findOneByNickname(senderNickname);

    const conversation =
      await this.conversationService.findOneById(conversationId);

    const newMessage = this.messagesRepository.create({
      sender,
      conversation,
      content,
    });
    return this.messagesRepository.save(newMessage);
  }
}
