import { IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMessageStatusDto {
  @IsNumber()
  @IsNotEmpty()
  @ApiProperty()
  messageId: number;

  @IsNumber()
  @IsNotEmpty()
  @ApiProperty()
  conversationId: number;

  @IsNumber()
  @IsNotEmpty()
  @ApiProperty()
  usersId: number[];
}
