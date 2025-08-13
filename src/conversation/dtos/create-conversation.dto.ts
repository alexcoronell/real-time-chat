/* eslint-disable @typescript-eslint/no-unsafe-call */
import { IsNumber, IsArray, IsNotEmpty } from 'class-validator';

export class CreateConversationDto {
  @IsArray()
  @IsNotEmpty()
  @IsNumber({}, { each: true })
  participantIds: number[];
}
