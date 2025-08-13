/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/* Services */
import { ConversationService } from '@conversation/conversation.service';
import { MessageStatusService } from '@message_status/message-status.service';
import { UserService } from '@user/user.service';

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
    private messageStatusService: MessageStatusService,
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
    const savedMessage = await this.messagesRepository.save(newMessage);

    const participants =
      await this.conversationService.getParticipants(conversationId);

    const recipientIds = participants
      .filter((p) => p.id !== sender.id)
      .map((p) => p.id);

    await this.messageStatusService.createMessageStatuses({
      conversationId,
      messageId: savedMessage.id,
      usersId: recipientIds,
    });

    return savedMessage;
  }
}
