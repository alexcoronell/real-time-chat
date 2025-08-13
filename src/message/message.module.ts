import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

/* Modules */
import { ConversationModule } from '@conversation/conversation.module';
import { MessageStatusModule } from '@message_status/message-status.module';
import { UserModule } from '@user/user.module';

import { MessageService } from './message.service';
import { Message } from './entities/message.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message]),
    ConversationModule,
    MessageStatusModule,
    UserModule,
  ],
  providers: [MessageService],
  exports: [MessageService],
})
export class MessageModule {}
