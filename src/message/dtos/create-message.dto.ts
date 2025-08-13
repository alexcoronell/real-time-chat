/* eslint-disable @typescript-eslint/no-unsafe-call */
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';
import { Trim } from '@commons/decorators/tim.decorator';

export class CreateMessageDto {
  @IsNumber()
  @IsNotEmpty()
  conversationId: number;

  @IsString()
  @IsNotEmpty()
  @Trim()
  content: string;

  @IsString()
  @IsNotEmpty()
  senderNickname: string;
}
