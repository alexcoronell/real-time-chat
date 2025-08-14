/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/* Services */
import { UserService } from '@user/user.service';

/* Entities */
import { Conversation } from './entities/conversation.entity';
import { User } from '@user/entities/user.entity';

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(Conversation)
    private repo: Repository<Conversation>,
    private userService: UserService,
  ) {}

  async findOneById(id: number) {
    const conversation = await this.repo.findOne({
      where: { id },
      relations: ['participants', 'messages'],
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation with ID ${id} not found.`);
    }
    return conversation;
  }

  async findOrCreate(participantIds: number[]): Promise<Conversation> {
    // ✅ VALIDACIÓN ESTRICTA: Solo 2 participantes
    if (!participantIds || participantIds.length !== 2) {
      throw new BadRequestException(
        'La conversación debe tener exactamente dos participantes',
      );
    }

    // ✅ Eliminar duplicados y validar IDs únicos
    const uniqueIds = [...new Set(participantIds)];
    if (uniqueIds.length !== 2) {
      throw new BadRequestException(
        'Los participantes deben ser usuarios diferentes',
      );
    }

    const [userId1, userId2] = uniqueIds.sort(); // Ordenar para consistencia

    console.log(
      `🔍 Buscando conversación entre usuarios: ${userId1} y ${userId2}`,
    );

    // ✅ BÚSQUEDA CORREGIDA: Buscar conversación exacta entre 2 usuarios
    const existingConversation = await this.repo
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.participants', 'participant')
      .leftJoinAndSelect('conversation.messages', 'message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where((qb) => {
        const subQuery = qb
          .subQuery()
          .select('c.id')
          .from(Conversation, 'c')
          .leftJoin('c.participants', 'p')
          .where('p.id IN (:...userIds)', { userIds: [userId1, userId2] })
          .groupBy('c.id')
          .having('COUNT(DISTINCT p.id) = 2')
          .andHaving('COUNT(p.id) = 2') // Exactamente 2 participantes
          .getQuery();
        return 'conversation.id IN ' + subQuery;
      })
      .orderBy('conversation.createdAt', 'DESC')
      .getOne();

    // ✅ Si existe, retornar con relaciones completas
    if (existingConversation) {
      console.log(
        '✅ Conversación existente encontrada:',
        existingConversation.id,
      );
      return existingConversation;
    }

    // ✅ VALIDAR que los usuarios existen antes de crear
    const users = await this.userService.findAllById([userId1, userId2]);
    if (users.length !== 2) {
      throw new NotFoundException('Uno o más usuarios no encontrados');
    }

    // ✅ Crear nueva conversación
    console.log('💬 Creando nueva conversación...');
    const newConversation = this.repo.create({
      participants: users,
    });

    const savedConversation = await this.repo.save(newConversation);

    // ✅ Retornar con relaciones completas
    const conversation = await this.repo.findOne({
      where: { id: savedConversation.id },
      relations: ['participants', 'messages', 'messages.sender'],
    });

    if (!conversation) throw new NotFoundException();

    return conversation;
  }

  async findConversationsByParticipantId(
    participantId: number,
  ): Promise<Conversation[]> {
    const conversations = await this.repo
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.participants', 'participant')
      .leftJoinAndSelect('conversation.messages', 'message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('participant.id = :participantId', { participantId })
      .addOrderBy('message.createdAt', 'ASC')
      .getMany();

    return conversations;
  }

  async getMessages(id: number) {
    const conversation = await this.repo.findOne({
      where: { id },
      relations: ['messages', 'messages.sender'],
    });
    return conversation?.messages || [];
  }

  async getParticipants(conversationId: number): Promise<User[]> {
    const conversation = await this.repo.findOne({
      where: { id: conversationId },
      relations: ['participants'],
    });

    if (!conversation) {
      throw new NotFoundException(
        `Conversation with ID ${conversationId} not found.`,
      );
    }

    return conversation.participants;
  }

  // ✅ NUEVO: Método para validar participantes
  async validateParticipants(
    conversationId: number,
    userId: number,
  ): Promise<boolean> {
    const conversation = await this.repo.findOne({
      where: { id: conversationId },
      relations: ['participants'],
    });

    if (!conversation) {
      return false;
    }

    return conversation.participants.some(
      (participant) => participant.id === userId,
    );
  }
}
