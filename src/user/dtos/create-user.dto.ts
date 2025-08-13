/* eslint-disable @typescript-eslint/no-unsafe-call */
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Trim } from '@commons/decorators/tim.decorator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @Trim()
  @ApiProperty()
  readonly nickname: string;
}
