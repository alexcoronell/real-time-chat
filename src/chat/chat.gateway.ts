/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UsePipes, ValidationPipe } from '@nestjs/common';
import { User } from '@user/entities/user.entity';

/* Services */
import { ConversationService } from '@conversation/conversation.service';
import { UserService } from '@user/user.service';

/* DTOS */
//import { CreateConversationDto } from '@conversation/dtos/create-conversation.dto';

@WebSocketGateway({
  cors: '*',
  credentials: true,
  // ✅ Configuración optimizada para tiempo real
  pingTimeout: 60000,
  pingInterval: 25000,
})
@UsePipes(new ValidationPipe())
export class ChatGateway
  implements OnModuleInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  public server: Server;

  constructor(
    private readonly userService: UserService,
    private conversationService: ConversationService,
  ) {}

  private connectedUsers = new Map<
    string,
    { socketId: string; user: User; connectedAt: Date; lastSeen: Date }
  >();
  private usersByNickname = new Map<string, string>(); // nickname -> socketId
  private heartbeatIntervals = new Map<string, NodeJS.Timeout>();
  private readonly ONLINE_USERS_CHAT = 'online_users';
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 segundos
  private readonly HEARTBEAT_TIMEOUT = 60000; // 60 segundos sin respuesta = desconectado

  onModuleInit() {
    console.log('🚀 ChatGateway inicializado - Limpiando estado...');
    this.connectedUsers.clear();
    this.usersByNickname.clear();
    this.heartbeatIntervals.clear();

    this.scheduleCleanup();
    this.scheduleHeartbeatCheck();
  }

  handleConnection(client: Socket) {
    console.log(`🔗 Cliente conectado: ${client.id}`);

    this.cleanupSocketId(client.id);

    this.setupHeartbeat(client);

    client.on('disconnect', (reason) => {
      console.log(
        `🔌 Disconnect event - Socket: ${client.id}, Reason: ${reason}`,
      );
      this.handleActualDisconnect(client);
    });

    client.on('error', (error) => {
      console.error(`❌ Socket error - ${client.id}:`, error);
      this.handleActualDisconnect(client);
    });

    client.on('heartbeat_response', () => {
      this.updateLastSeen(client.id);
    });
  }

  handleDisconnect(client: Socket) {
    console.log(`🔌 Cliente desconectándose: ${client.id}`);
  }

  private handleActualDisconnect(client: Socket) {
    console.log(`🚪 Limpiando desconexión: ${client.id}`);

    this.clearHeartbeat(client.id);

    const disconnectedUser = this.connectedUsers.get(client.id);

    if (disconnectedUser) {
      const nickname = disconnectedUser.user.nickname;

      const currentSocketId = this.usersByNickname.get(nickname);
      if (currentSocketId === client.id) {
        this.usersByNickname.delete(nickname);
      }

      this.connectedUsers.delete(client.id);

      client.leave(this.ONLINE_USERS_CHAT);

      this.broadcastToOnlineChat('user_disconnected', {
        nickname: nickname,
        socketId: client.id,
        totalOnline: this.getValidConnectedUsers().length,
      });

      this.broadcastConnectedUsersToChat();

      console.log(`✅ Usuario ${nickname} desconectado y limpiado`);
    } else {
      this.connectedUsers.delete(client.id);
    }
  }

  @SubscribeMessage('check_or_create_user')
  async handleCheckOrCreateUser(
    @MessageBody() data: { nickname: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { nickname } = data;

      if (!nickname) {
        return { success: false, error: 'Nickname is empty' };
      }

      console.log(
        `👤 Registrando usuario: ${nickname} con socket: ${client.id}`,
      );

      this.cleanupUserByNickname(nickname);
      this.cleanupSocketId(client.id);

      const user: User = await this.userService.findOrCreate({
        nickname: nickname.toLowerCase(),
      });

      await client.join(this.ONLINE_USERS_CHAT);

      this.connectedUsers.set(client.id, {
        socketId: client.id,
        user,
        connectedAt: new Date(),
        lastSeen: new Date(),
      });
      this.usersByNickname.set(nickname, client.id);

      console.log(
        `✅ Usuario registrado: ${nickname}, Total conectados: ${this.connectedUsers.size}`,
      );

      this.broadcastToOnlineChat('user_connected', {
        user,
        socketId: client.id,
        totalOnline: this.getValidConnectedUsers().length,
      });

      this.broadcastConnectedUsersToChat();

      return { success: true, user };
    } catch (error) {
      console.error(`❌ Error al registrar usuario:`, error);
      return { success: false, error: error.message };
    }
  }

  private cleanupUserByNickname(nickname: string) {
    const existingSocketId = this.usersByNickname.get(nickname);

    if (existingSocketId) {
      console.log(
        `🧹 Limpiando conexión anterior para ${nickname}: ${existingSocketId}`,
      );

      const existingSocket = this.server.sockets.sockets.get(existingSocketId);

      if (existingSocket) {
        existingSocket.leave(this.ONLINE_USERS_CHAT);
        existingSocket.disconnect(true);
      }

      this.connectedUsers.delete(existingSocketId);
      this.usersByNickname.delete(nickname);
    }
  }

  private cleanupSocketId(socketId: string) {
    const existingUser = this.connectedUsers.get(socketId);

    if (existingUser) {
      console.log(`🧹 Limpiando socket ID existente: ${socketId}`);

      const nickname = existingUser.user.nickname;

      if (this.usersByNickname.get(nickname) === socketId) {
        this.usersByNickname.delete(nickname);
      }

      this.connectedUsers.delete(socketId);
    }
  }

  private getValidConnectedUsers(): Array<{
    socketId: string;
    user: User;
    connectedAt: Date;
    lastSeen: Date;
  }> {
    const validUsers: Array<{
      socketId: string;
      user: User;
      connectedAt: Date;
      lastSeen: Date;
    }> = [];
    const socketsToRemove: string[] = [];

    for (const [socketId, userData] of this.connectedUsers.entries()) {
      const socket = this.server.sockets.sockets.get(socketId);

      if (socket && socket.connected) {
        validUsers.push(userData);
      } else {
        console.log(
          `🗑️ Socket desconectado encontrado: ${socketId}, marcando para eliminación`,
        );
        socketsToRemove.push(socketId);
      }
    }

    for (const socketId of socketsToRemove) {
      const userData = this.connectedUsers.get(socketId);
      if (userData) {
        const nickname = userData.user.nickname;
        if (this.usersByNickname.get(nickname) === socketId) {
          this.usersByNickname.delete(nickname);
        }
      }
      this.connectedUsers.delete(socketId);
      this.clearHeartbeat(socketId);
    }

    return validUsers;
  }

  private scheduleCleanup() {
    setInterval(() => {
      const beforeCount = this.connectedUsers.size;
      this.getValidConnectedUsers();
      const afterCount = this.connectedUsers.size;

      if (beforeCount !== afterCount) {
        console.log(
          `🧹 Limpieza automática: ${beforeCount - afterCount} conexiones eliminadas`,
        );
        this.broadcastConnectedUsersToChat();
      }
    }, 30000);
  }

  private setupHeartbeat(client: Socket) {
    console.log(`💓 Configurando heartbeat para ${client.id}`);

    const interval = setInterval(() => {
      if (client.connected) {
        console.log(`💓 Enviando heartbeat a ${client.id}`);

        client.emit('heartbeat_request', { timestamp: Date.now() });

        const userData = this.connectedUsers.get(client.id);
        if (userData) {
          const timeSinceLastSeen = Date.now() - userData.lastSeen.getTime();

          if (timeSinceLastSeen > this.HEARTBEAT_TIMEOUT) {
            console.log(
              `⚠️ Cliente ${client.id} no responde hace ${timeSinceLastSeen}ms, desconectando...`,
            );
            this.forceDisconnect(client.id, 'heartbeat_timeout');
          }
        }
      } else {
        console.log(
          `💓 Cliente ${client.id} ya no está conectado, limpiando heartbeat`,
        );
        this.clearHeartbeat(client.id);
      }
    }, this.HEARTBEAT_INTERVAL);

    this.heartbeatIntervals.set(client.id, interval);
  }

  private clearHeartbeat(socketId: string) {
    const interval = this.heartbeatIntervals.get(socketId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(socketId);
      console.log(`💓 Heartbeat limpiado para ${socketId}`);
    }
  }

  private updateLastSeen(socketId: string) {
    const userData = this.connectedUsers.get(socketId);
    if (userData) {
      userData.lastSeen = new Date();
      console.log(`💓 Pong recibido de ${socketId}`);
    }
  }

  private forceDisconnect(socketId: string, reason: string) {
    console.log(`🔨 Forzando desconexión de ${socketId}, razón: ${reason}`);

    const socket = this.server.sockets.sockets.get(socketId);
    if (socket) {
      socket.disconnect(true);
    }

    this.handleActualDisconnect({ id: socketId } as Socket);
  }

  private scheduleHeartbeatCheck() {
    setInterval(() => {
      const now = Date.now();
      const socketsToDisconnect: string[] = [];

      for (const [socketId, userData] of this.connectedUsers.entries()) {
        const timeSinceLastSeen = now - userData.lastSeen.getTime();

        if (timeSinceLastSeen > this.HEARTBEAT_TIMEOUT) {
          socketsToDisconnect.push(socketId);
        }
      }

      if (socketsToDisconnect.length > 0) {
        console.log(
          `🕐 Encontrados ${socketsToDisconnect.length} usuarios inactivos, desconectando...`,
        );

        for (const socketId of socketsToDisconnect) {
          this.forceDisconnect(socketId, 'inactive_timeout');
        }
      }
    }, 20000);
  }

  private broadcastToOnlineChat(event: string, data: any) {
    this.server.to(this.ONLINE_USERS_CHAT).emit(event, data);
  }

  private broadcastConnectedUsersToChat() {
    const validUsers = this.getValidConnectedUsers();

    const usersList = validUsers.map((conn) => ({
      socketId: conn.socketId,
      nickname: conn.user.nickname,
      id: conn.user.id,
      connectedAt: conn.connectedAt,
    }));

    const uniqueUsers = usersList.filter(
      (user, index, array) =>
        array.findIndex((u) => u.nickname === user.nickname) === index,
    );

    console.log(`📤 Broadcasting usuarios conectados: ${uniqueUsers.length}`);

    this.server.to(this.ONLINE_USERS_CHAT).emit('users_online', {
      count: uniqueUsers.length,
      users: uniqueUsers,
    });
  }

  @SubscribeMessage('get_connected_users')
  handleGetConnectedUsers(@ConnectedSocket() client: Socket) {
    const validUsers = this.getValidConnectedUsers();

    const usersList = validUsers.map((conn) => ({
      socketId: conn.socketId,
      nickname: conn.user.nickname,
      id: conn.user.id,
      connectedAt: conn.connectedAt,
    }));

    const uniqueUsers = usersList.filter(
      (user, index, array) =>
        array.findIndex((u) => u.nickname === user.nickname) === index,
    );

    client.emit('users_online', {
      count: uniqueUsers.length,
      users: uniqueUsers,
    });
  }

  @SubscribeMessage('debug_connections')
  handleDebugConnections(@ConnectedSocket() client: Socket) {
    if (process.env.NODE_ENV === 'development') {
      const connectedSocketsCount = this.server.sockets.sockets.size;
      const registeredUsersCount = this.connectedUsers.size;
      const nicknameMapCount = this.usersByNickname.size;

      client.emit('debug_info', {
        connectedSockets: connectedSocketsCount,
        registeredUsers: registeredUsersCount,
        nicknameMap: nicknameMapCount,
        usersList: Array.from(this.connectedUsers.values()).map((u) => ({
          socketId: u.socketId,
          nickname: u.user.nickname,
          connectedAt: u.connectedAt,
          lastSeen: u.lastSeen,
        })),
      });
    }
  }

  @SubscribeMessage('heartbeat')
  handleHeartbeat(@ConnectedSocket() client: Socket) {
    this.updateLastSeen(client.id);
    client.emit('heartbeat_ack', { timestamp: Date.now() });
  }

  @SubscribeMessage('heartbeat_response')
  handleHeartbeatResponse(@ConnectedSocket() client: Socket) {
    this.updateLastSeen(client.id);
    console.log(`💓 Heartbeat response recibido de ${client.id}`);
  }

  /************************************************************************************************************************/
  /************************************************* CONVERSATION METHODS *************************************************/
  /************************************************************************************************************************/

  // ✅ Método optimizado para encontrar sockets de usuarios
  private findSocketsByUserId(userId: number): string[] {
    const sockets: string[] = [];
    for (const [socketId, userData] of this.connectedUsers.entries()) {
      if (userData.user.id === userId) {
        const socket = this.server.sockets.sockets.get(socketId);
        if (socket && socket.connected) {
          sockets.push(socketId);
        }
      }
    }
    return sockets;
  }

  @SubscribeMessage('get_conversations')
  async handleGetConversations(
    @MessageBody() data: { userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { userId } = data;

      if (!userId) {
        client.emit('conversations_list', {
          success: false,
          error: 'User ID is missing',
        });
        return;
      }

      console.log(`📋 Obteniendo conversaciones para usuario: ${userId}`);

      const conversations =
        await this.conversationService.findConversationsByParticipantId(userId);

      console.log(`✅ Encontradas ${conversations.length} conversaciones`);

      // ✅ Respuesta inmediata sin delay
      client.emit('conversations_list', {
        success: true,
        conversations,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error(`❌ Error al obtener conversaciones:`, error);
      client.emit('conversations_list', {
        success: false,
        error: error.message,
      });
    }
  }

  @SubscribeMessage('check_or_create_conversation')
  async handleCheckOrCreateConversation(
    @MessageBody() data: { participantIds: number[] },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { participantIds } = data;

      // ✅ VALIDACIÓN MEJORADA
      if (!participantIds || !Array.isArray(participantIds)) {
        client.emit('conversation_result', {
          success: false,
          error: 'participantIds debe ser un array válido',
        });
        return;
      }

      if (participantIds.length !== 2) {
        client.emit('conversation_result', {
          success: false,
          error: 'La conversación debe tener exactamente 2 participantes',
        });
        return;
      }

      const [userId1, userId2] = participantIds;
      if (userId1 === userId2) {
        client.emit('conversation_result', {
          success: false,
          error: 'No puedes crear una conversación contigo mismo',
        });
        return;
      }

      console.log(
        `💬 Solicitud de conversación entre: ${userId1} y ${userId2}`,
      );

      const conversation =
        await this.conversationService.findOrCreate(participantIds);
      const conversationRoom = `conversation-${conversation.id}`;

      console.log(`🏠 Room configurado: ${conversationRoom}`);

      // ✅ 1. RESPUESTA INMEDIATA al cliente que hizo la petición
      client.emit('conversation_result', {
        success: true,
        conversation,
        timestamp: new Date(),
      });

      console.log(`✅ conversation_result enviado a ${client.id}`);

      // ✅ 2. Unir a todos los participantes al room
      const joinPromises = participantIds.map(async (participantId) => {
        const socketIds = this.findSocketsByUserId(participantId);

        for (const socketId of socketIds) {
          const participantSocket = this.server.sockets.sockets.get(socketId);
          if (participantSocket && participantSocket.connected) {
            await participantSocket.join(conversationRoom);
            console.log(`✅ Socket ${socketId} unido a ${conversationRoom}`);
          }
        }
      });

      await Promise.all(joinPromises);

      // ✅ 3. Emitir actualización a TODOS los participantes (incluye al que la creó)
      this.server.to(conversationRoom).emit('conversations_updated', {
        success: true,
        conversation: conversation,
        timestamp: new Date(),
      });

      console.log(
        `📡 conversations_updated enviado a room ${conversationRoom}`,
      );

      // ✅ 4. ADICIONAL: Enviar notificación individual a cada participante
      for (const participantId of participantIds) {
        const socketIds = this.findSocketsByUserId(participantId);
        for (const socketId of socketIds) {
          const socket = this.server.sockets.sockets.get(socketId);
          if (socket && socket.connected) {
            // Solo enviar si NO es el cliente que hizo la petición (ya recibió conversation_result)
            if (socket.id !== client.id) {
              socket.emit('conversations_updated', {
                success: true,
                conversation,
                timestamp: new Date(),
              });
              console.log(
                `📨 conversations_updated enviado individualmente a ${socket.id}`,
              );
            }
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error al crear/buscar conversación:`, error);
      client.emit('conversation_result', {
        success: false,
        error: error.message,
      });
    }
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @MessageBody() data: { conversationId: number; userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { conversationId, userId } = data;

      // ✅ Validar que el usuario es participante de la conversación
      const isParticipant = await this.conversationService.validateParticipants(
        conversationId,
        userId,
      );

      if (!isParticipant) {
        client.emit('join_conversation_result', {
          success: false,
          error: 'No tienes permisos para unirte a esta conversación',
        });
        return;
      }

      const conversationRoom = `conversation-${conversationId}`;
      await client.join(conversationRoom);

      console.log(
        `✅ Usuario ${userId} se unió a conversación ${conversationId}`,
      );

      client.emit('join_conversation_result', {
        success: true,
        conversationId,
        room: conversationRoom,
      });
    } catch (error) {
      console.error(`❌ Error al unirse a conversación:`, error);
      client.emit('join_conversation_result', {
        success: false,
        error: error.message,
      });
    }
  }
}
