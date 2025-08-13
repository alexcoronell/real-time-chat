import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';

/* Modules */
import { ConversationModule } from '@conversation/conversation.module';
import { MessageModule } from '@message/message.module';
import { UserModule } from '@user/user.module';

@Module({
  imports: [ConversationModule, MessageModule, UserModule],
  providers: [ChatGateway, ChatService],
})
export class ChatModule {}
