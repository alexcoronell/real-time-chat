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
import { User } from '@user/entities/user.entity';
import { CreateMessageDto } from '@message/dtos/create-message.dto';

@WebSocketGateway({ namespace: '/chat' })
@UsePipes(new ValidationPipe())
export class ChatGateway {
  @WebSocketServer()
  private server: Server;

  constructor(private readonly chatService: ChatService) {}

  async handleConnection(client: Socket) {
    const { nickname } = client.handshake.auth;

    if (!nickname) {
      client.disconnect();
      return;
    }

    try {
      // Intenta encontrar las conversaciones del usuario
      const { conversations } = (await this.chatService.findUserConversations(
        nickname,
      )) as User;

      // Si el usuario tiene conversaciones, lo unimos a sus salas
      if (conversations) {
        conversations.forEach((conversation) => {
          client.join(conversation.id.toString());
        });

        // Emitimos un evento al cliente con sus conversaciones
        client.emit('conversationsLoaded', conversations);
      }
    } catch (error) {
      console.error('Error durante la conexión:', error.message);
      client.emit('error', 'Error al cargar las conversaciones.');
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Cliente desconectado: ${client.id}`);
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() payload: CreateMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { nickname } = client.handshake.auth;

      if (nickname !== payload.senderNickname) {
        client.emit('error', 'Unauthorized action.');
        return;
      }

      const newMessage = await this.chatService.sendMessage(payload);

      this.server
        .to(newMessage.conversation.id.toString())
        .emit('on-message', newMessage);
    } catch (error) {
      client.emit('error', error.message);
    }
  }
}
