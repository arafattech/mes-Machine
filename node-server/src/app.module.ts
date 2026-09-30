import { NotificationModule } from '@module/notification/notification.module';
import { MachineModule } from '@module/machine/machine.module';
import { CalculationsModule } from '@module/machine/calculations.module';
import { ImportModule } from '@module/import/import.module';

import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { join } from 'path';
import { ServeStaticModule } from '@nestjs/serve-static';
import { apiRoutes } from './routers/api.route';
import { PrismaService } from '@prisma/prisma.service';
import { AuthMiddleWare } from 'middleware/auth/Auth.middleware';

@Module({
  imports: [
    NotificationModule,
    MachineModule,
    CalculationsModule,
    ImportModule,
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'storage', 'public'),
      serveRoot: '/public',
      serveStaticOptions: { index: false },
    }),
    RouterModule.register([
      {
        path: 'api',
        children: apiRoutes,
      },
    ]),
  ],
  controllers: [],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleWare).forRoutes('api/machine/*path', 'api/work-orders/*path');
  }
}
