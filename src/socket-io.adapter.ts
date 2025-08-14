/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// socket-io.adapter.ts
import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';

export class SocketIoAdapter extends IoAdapter {
  constructor(private app: INestApplicationContext) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    console.log(`🔌 Configurando Socket.io en puerto: ${port}`);

    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: '*',
        credentials: true,
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true, // Compatibilidad
    });

    console.log(`✅ Socket.io servidor creado correctamente`);
    return server;
  }
}
