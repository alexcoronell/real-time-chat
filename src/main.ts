/* eslint-disable @typescript-eslint/no-floating-promises */
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as morgan from 'morgan';
import { SocketIoAdapter } from './socket-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3000;

  app.use(morgan('dev'));

  app.enableCors({
    origin: '*',
    credentials: true,
  });

  app.useWebSocketAdapter(new SocketIoAdapter(app));

  await app.listen(port);

  console.log(`🚀 Servidor HTTP corriendo en: http://localhost:${port}`);
  console.log(
    `🔌 Socket.io disponible en: http://localhost:${port}/socket.io/`,
  );
}

bootstrap();
