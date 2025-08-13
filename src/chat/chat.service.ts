/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';

import { ConversationService } from '@conversation/conversation.service';
import { MessageService } from '@message/message.service';
import { UserService } from '@user/user.service';

import { CreateConversationDto } from '@conversation/dtos/create-conversation.dto';
import { CreateMessageDto } from '@message/dtos/create-message.dto';

@Injectable()
export class ChatService {
  constructor(
    private readonly userService: UserService,
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
  ) {}

  async findUserConversations(nickname: string) {
    const user =
      await this.userService.findOneByNicknameWithConversations(nickname);
    return user;
  }

  async findOrCreateConversation(dto: CreateConversationDto) {
    return await this.conversationService.findOrCreate(dto);
  }

  async getConversationMessages(conversationId: number) {
    return await this.conversationService.getMessages(conversationId);
  }

  async sendMessage(dto: CreateMessageDto) {
    return await this.messageService.create(dto);
  }
}
