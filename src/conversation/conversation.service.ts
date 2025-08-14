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
      relations: ['participants', 'messages', 'messages.sender']
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

    // ✅ BÚSQUEDA MEJORADA: Buscar conversación exacta entre 2 usuarios
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
      .addOrderBy('message.createdAt', 'ASC')
      .orderBy('conversation.createdAt', 'DESC')
      .getOne();

    // ✅ Si existe, validar y retornar con relaciones completas
    if (existingConversation) {
      console.log(
        '✅ Conversación existente encontrada:',
        existingConversation.id,
      );
      console.log(
        '👥 Participantes cargados:',
        existingConversation.participants?.length,
      );
      console.log(
        '💬 Mensajes cargados:',
        existingConversation.messages?.length,
      );

      // DEBUG: Verificar que los participantes estén correctamente cargados
      if (existingConversation.participants) {
        existingConversation.participants.forEach((participant, index) => {
          console.log(`👤 Participante ${index + 1}:`, {
            id: participant.id,
            nickname: participant.nickname,
          });
        });
      }

      return existingConversation;
    }

    // ✅ VALIDAR que los usuarios existen antes de crear
    console.log('🔍 Validando usuarios antes de crear conversación...');
    const users = await this.userService.findAllById([userId1, userId2]);
    console.log('👥 Usuarios encontrados:', users.length);

    if (users.length !== 2) {
      throw new NotFoundException('Uno o más usuarios no encontrados');
    }

    users.forEach((user, index) => {
      console.log(`👤 Usuario ${index + 1} para nueva conversación:`, {
        id: user.id,
        nickname: user.nickname,
      });
    });

    // ✅ Crear nueva conversación
    console.log('💬 Creando nueva conversación...');
    const newConversation = this.repo.create({
      participants: users,
    });

    const savedConversation = await this.repo.save(newConversation);
    console.log('💾 Conversación guardada con ID:', savedConversation.id);

    // ✅ Retornar con relaciones completas
    const conversation = await this.repo.findOne({
      where: { id: savedConversation.id },
      relations: ['participants', 'messages', 'messages.sender'],
      order: {
        messages: {
          createdAt: 'ASC',
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Error al recuperar la conversación creada');
    }

    console.log('✅ Nueva conversación creada y cargada:', conversation.id);
    console.log(
      '👥 Participantes en nueva conversación:',
      conversation.participants?.length,
    );

    if (conversation.participants) {
      conversation.participants.forEach((participant, index) => {
        console.log(`👤 Participante ${index + 1}:`, {
          id: participant.id,
          nickname: participant.nickname,
        });
      });
    }

    return conversation;
  }

  async findConversationsByParticipantId(
    participantId: number,
  ): Promise<Conversation[]> {
    console.log(`📋 Buscando conversaciones para usuario: ${participantId}`);

    // ✅ CORREGIDO: Primero obtenemos los IDs de conversaciones donde participa el usuario
    // y luego cargamos las conversaciones completas con TODOS sus participantes
    const conversationIds = await this.repo
      .createQueryBuilder('conversation')
      .select('conversation.id')
      .leftJoin('conversation.participants', 'participant')
      .where('participant.id = :participantId', { participantId })
      .getMany();

    if (conversationIds.length === 0) {
      console.log('📋 No se encontraron conversaciones para este usuario');
      return [];
    }

    const ids = conversationIds.map((conv) => conv.id);
    console.log(`📋 IDs de conversaciones encontradas: [${ids.join(', ')}]`);

    // ✅ Ahora cargamos las conversaciones completas con TODOS los participantes
    const conversations = await this.repo
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.participants', 'participant')
      .leftJoinAndSelect('conversation.messages', 'message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('conversation.id IN (:...ids)', { ids })
      .addOrderBy('message.createdAt', 'ASC')
      .orderBy('conversation.createdAt', 'DESC')
      .getMany();

    console.log(
      `📋 Conversaciones cargadas completamente: ${conversations.length}`,
    );

    // DEBUG: Verificar cada conversación
    conversations.forEach((conv, index) => {
      console.log(`💬 Conversación ${index + 1}:`, {
        id: conv.id,
        participantCount: conv.participants?.length,
        messageCount: conv.messages?.length,
      });

      if (conv.participants) {
        conv.participants.forEach((participant, pIndex) => {
          console.log(`  👤 Participante ${pIndex + 1}:`, {
            id: participant.id,
            nickname: participant.nickname,
          });
        });
      }
    });

    return conversations;
  }

  async getMessages(id: number) {
    const conversation = await this.repo.findOne({
      where: { id },
      relations: ['messages', 'messages.sender'],
      order: {
        messages: {
          createdAt: 'ASC',
        },
      },
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
