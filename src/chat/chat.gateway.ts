/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UsePipes, ValidationPipe } from '@nestjs/common';

import { ChatService } from './chat.service';
import { UserService } from '@user/user.service';
import { User } from '@user/entities/user.entity';
import { CreateMessageDto } from '@message/dtos/create-message.dto';

// chat.gateway.ts - Versión simplificada para debug
@WebSocketGateway({
  cors: '*',
  credentials: true,
})
@UsePipes(new ValidationPipe())
export class ChatGateway {
  @WebSocketServer()
  public server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly userService: UserService,
  ) {}

  private connectedUsers = new Map<
    string,
    { socketId: string; nickname: string; user: any }
  >();
  private readonly ONLINE_USERS_CHAT = 'online_users';

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

      const user: User = await this.userService.findOrCreate({ nickname });

      await client.join(this.ONLINE_USERS_CHAT);

      this.connectedUsers.set(client.id, {
        socketId: client.id,
        nickname: nickname,
        user: user,
      });

      this.broadcastToOnlineChat('user_connected', {
        nickname: nickname,
        socketId: client.id,
        totalOnline: this.connectedUsers.size,
      });

      this.broadcastConnectedUsersToChat();

      return { success: true, user: user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  handleDisconnect(client: Socket) {
    const disconnectedUser = this.connectedUsers.get(client.id);
    this.connectedUsers.delete(client.id);
    console.log(client.id);

    if (disconnectedUser) {
      // ✅ Notificar desconexión
      this.broadcastToOnlineChat('user_disconnected', {
        nickname: disconnectedUser.nickname,
        socketId: client.id,
        totalOnline: this.connectedUsers.size,
      });

      this.broadcastConnectedUsersToChat();
    }
  }

  private broadcastToOnlineChat(event: string, data: any) {
    this.server.to(this.ONLINE_USERS_CHAT).emit(event, data);
  }

  private broadcastConnectedUsersToChat() {
    const usersList = Array.from(this.connectedUsers.values()).map((conn) => ({
      socketId: conn.socketId,
      nickname: conn.nickname,
      id: conn.user.id,
    }));

    this.server.to(this.ONLINE_USERS_CHAT).emit('users_online', {
      count: usersList.length,
      users: usersList,
    });
  }
}
