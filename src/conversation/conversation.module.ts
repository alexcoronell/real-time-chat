import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

/* Modules */
import { UserModule } from '@user/user.module';

import { ConversationService } from './conversation.service';
import { Conversation } from './entities/conversation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation]), UserModule],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
