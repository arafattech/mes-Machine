// src/main.ts
import './factory-timezone';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });

  // Attach Socket.IO to the HTTP server before listen so onModuleInit hooks
  // in services can safely call socketService.on() / socketService.onConnection().
  const { socketService } = await import('./config/socket/socket.config');
  socketService.initialize(app.getHttpServer());

  const expose = '0.0.0.0';
  await app.listen(process.env.SERVER_PORT || 3000, expose);
  console.log(`RUNNING AT PORT : ${process.env.SERVER_PORT}`);
}


bootstrap();
