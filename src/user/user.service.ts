import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
}
