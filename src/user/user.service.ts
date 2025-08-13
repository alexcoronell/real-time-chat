/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dtos/create-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private repo: Repository<User>,
  ) {}

  async findOrCreate(dto: CreateUserDto): Promise<User> {
    let user = await this.repo.findOneBy(dto);
    if (!user) {
      user = this.repo.create(dto);
      await this.repo.save(user);
    }
    return user;
  }

  async findAllById(ids: number[]) {
    return await this.repo.find({
      where: { id: In(ids) },
    });
  }

  async findOneByNickname(nickname: string) {
    const user = await this.repo.findOneBy({ nickname });
    if (!user) {
      throw new NotFoundException(`User with nickname ${nickname} not found.`);
    }
    return user;
  }
}
