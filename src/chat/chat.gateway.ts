/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { OnModuleInit } from '@nestjs/common';

@WebSocketGateway()
export class ChatGateway implements OnModuleInit {
  @WebSocketServer()
  private server: Server;

  constructor(private readonly chatService: ChatService) {}

  onModuleInit() {
    this.server.on('connection', (socket: Socket) => {
      const { nickname, token } = socket.handshake.auth;
      if (!nickname && !token) {
        socket.disconnect();
        return;
      }

      this.chatService.onClientConnected({ id: socket.id, nickname: nickname });

      socket.emit('welcome-message', 'Bienvenido al chat de SDH Inc.');

      this.server.emit('on-clients-changed', this.chatService.getClients());

      socket.on('disconnect', () => {
        this.chatService.onClientDisconnected(socket.id);
        this.server.emit('on-clients-changed', this.chatService.getClients());
      });
    });
  }

  @SubscribeMessage('send-message')
  handleMessage(
    @MessageBody() userReceiver: string,
    message: string,
    @ConnectedSocket() client: Socket,
  ) {
    const { nickname } = client.handshake.auth;
    if (!message) return;

    this.server.emit('on-message', {
      userId: client.id,
      message,
      nickname,
      userReceiver,
    });
  }
}
