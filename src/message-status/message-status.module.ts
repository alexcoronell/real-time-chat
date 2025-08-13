import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MessageStatusService } from './message-status.service';

import { MessageStatus } from './entities/message-status.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MessageStatus])],
  providers: [MessageStatusService],
})
export class MessageStatusModule {}
