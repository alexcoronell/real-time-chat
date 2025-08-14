import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import 'reflect-metadata';

import { ChatModule } from './chat/chat.module';
import { DatabaseModule } from './database/database.module';
import { UserModule } from './user/user.module';
import { ConversationModule } from './conversation/conversation.module';
import { MessageModule } from './message/message.module';
import { MessageStatusModule } from './message-status/message-status.module';

/* Config */
import config from './config';
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.env.${process.env.NODE_ENV}`,
      load: [config],
      isGlobal: true,
    }),
    ChatModule,
    DatabaseModule,
    UserModule,
    ConversationModule,
    MessageModule,
    MessageStatusModule,
  ],
})
export class AppModule {}
