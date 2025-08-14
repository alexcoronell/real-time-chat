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
import { UserService } from '@user/user.service';
import { User } from '@user/entities/user.entity';

@WebSocketGateway({
  cors: '*',
  credentials: true,
})
@UsePipes(new ValidationPipe())
export class ChatGateway
  implements OnModuleInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  public server: Server;

  constructor(private readonly userService: UserService) {}

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

    // 🔧 Programar limpieza periódica de conexiones muertas
    this.scheduleCleanup();

    // 🔧 Programar verificación de heartbeats
    this.scheduleHeartbeatCheck();
  }

  handleConnection(client: Socket) {
    console.log(`🔗 Cliente conectado: ${client.id}`);

    // 🔧 Limpiar posibles registros antiguos de este socket ID
    this.cleanupSocketId(client.id);

    // 🔧 Configurar heartbeat para este cliente
    this.setupHeartbeat(client);

    // 🔧 Agregar listeners para detectar desconexiones
    client.on('disconnect', (reason) => {
      console.log(
        `🔌 Disconnect event - Socket: ${client.id}, Reason: ${reason}`,
      );
      this.handleActualDisconnect(client);
    });

    // 🔧 Listener para errores de conexión
    client.on('error', (error) => {
      console.error(`❌ Socket error - ${client.id}:`, error);
      this.handleActualDisconnect(client);
    });

    // 🔧 Listener para respuesta de heartbeat
    client.on('heartbeat_response', () => {
      this.updateLastSeen(client.id);
    });
  }

  handleDisconnect(client: Socket) {
    console.log(`🔌 Cliente desconectándose: ${client.id}`);
    // Solo registrar, la limpieza real se hace en handleActualDisconnect
  }

  private handleActualDisconnect(client: Socket) {
    console.log(`🚪 Limpiando desconexión: ${client.id}`);

    // 🔧 Limpiar heartbeat
    this.clearHeartbeat(client.id);

    const disconnectedUser = this.connectedUsers.get(client.id);

    if (disconnectedUser) {
      const nickname = disconnectedUser.user.nickname;

      // 🔧 Verificar que este socket sea realmente el actual para este nickname
      const currentSocketId = this.usersByNickname.get(nickname);
      if (currentSocketId === client.id) {
        this.usersByNickname.delete(nickname);
      }

      this.connectedUsers.delete(client.id);

      // 🔧 Asegurar que el socket salga de todos los rooms
      client.leave(this.ONLINE_USERS_CHAT);

      this.broadcastToOnlineChat('user_disconnected', {
        nickname: nickname,
        socketId: client.id,
        totalOnline: this.getValidConnectedUsers().length,
      });

      this.broadcastConnectedUsersToChat();

      console.log(`✅ Usuario ${nickname} desconectado y limpiado`);
    } else {
      // Limpiar por si acaso
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

      // 🔧 LIMPIEZA COMPLETA ANTES DE REGISTRAR
      this.cleanupUserByNickname(nickname);
      this.cleanupSocketId(client.id);

      const user: User = await this.userService.findOrCreate({ nickname });

      await client.join(this.ONLINE_USERS_CHAT);

      // 🔧 Registrar el nuevo usuario
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

  // 🔧 MÉTODOS DE LIMPIEZA

  private cleanupUserByNickname(nickname: string) {
    const existingSocketId = this.usersByNickname.get(nickname);

    if (existingSocketId) {
      console.log(
        `🧹 Limpiando conexión anterior para ${nickname}: ${existingSocketId}`,
      );

      // Verificar si el socket aún existe
      const existingSocket = this.server.sockets.sockets.get(existingSocketId);

      if (existingSocket) {
        // Socket existe, desconectarlo
        existingSocket.leave(this.ONLINE_USERS_CHAT);
        existingSocket.disconnect(true);
      }

      // Limpiar registros
      this.connectedUsers.delete(existingSocketId);
      this.usersByNickname.delete(nickname);
    }
  }

  private cleanupSocketId(socketId: string) {
    const existingUser = this.connectedUsers.get(socketId);

    if (existingUser) {
      console.log(`🧹 Limpiando socket ID existente: ${socketId}`);

      const nickname = existingUser.user.nickname;

      // Solo eliminar del mapa de nicknames si este socket era el actual
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

    // Limpiar sockets desconectados
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
    // 🔧 Limpieza cada 30 segundos
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

  // 🔧 SISTEMA DE HEARTBEAT PARA DETECTAR DESCONEXIONES

  private setupHeartbeat(client: Socket) {
    console.log(`💓 Configurando heartbeat para ${client.id}`);

    const interval = setInterval(() => {
      if (client.connected) {
        console.log(`💓 Enviando heartbeat a ${client.id}`);

        // 🔧 Usar emit en lugar de ping
        client.emit('heartbeat_request', { timestamp: Date.now() });

        // Verificar si no ha respondido en mucho tiempo
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
          `💔 Cliente ${client.id} ya no está conectado, limpiando heartbeat`,
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
      console.log(`💔 Heartbeat limpiado para ${socketId}`);
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

    // Limpiar manualmente por si el evento disconnect no se dispara
    this.handleActualDisconnect({ id: socketId } as Socket);
  }

  private scheduleHeartbeatCheck() {
    // 🔧 Verificación cada 20 segundos para usuarios sin actividad
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
    }, 20000); // Cada 20 segundos
  }

  // 🔧 MÉTODOS DE BROADCAST ACTUALIZADOS

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

    // 🔧 VERIFICACIÓN ADICIONAL: Eliminar duplicados por nickname (solo por seguridad)
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

    // Filtrar duplicados por seguridad
    const uniqueUsers = usersList.filter(
      (user, index, array) =>
        array.findIndex((u) => u.nickname === user.nickname) === index,
    );

    client.emit('users_online', {
      count: uniqueUsers.length,
      users: uniqueUsers,
    });
  }

  // 🔧 MÉTODO PARA DEBUG (opcional)
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

  // 🔧 MENSAJE PARA HEARTBEAT MANUAL DESDE EL CLIENTE
  @SubscribeMessage('heartbeat')
  handleHeartbeat(@ConnectedSocket() client: Socket) {
    this.updateLastSeen(client.id);
    client.emit('heartbeat_ack', { timestamp: Date.now() });
  }

  // 🔧 RESPUESTA A HEARTBEAT REQUEST
  @SubscribeMessage('heartbeat_response')
  handleHeartbeatResponse(@ConnectedSocket() client: Socket) {
    this.updateLastSeen(client.id);
    console.log(`💓 Heartbeat response recibido de ${client.id}`);
  }
}
