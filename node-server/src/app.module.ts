import { NotificationModule } from '@module/notification/notification.module';
import { BiometricsModule } from '@module/biometrics/biometrics.module';
import { MachineModule } from '@module/machine/machine.module';
import { CalculationsModule } from '@module/machine/calculations.module';
import { ImportModule } from '@module/import/import.module';
import { SalesForecastModule } from '@module/sales-forecast/sales-forecast.module';
import { EmployeeWeekendsModule } from '@module/hrm/employee-weekends/employee-weekends.module';

import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { join } from 'path';
import { ServeStaticModule } from '@nestjs/serve-static';
import { apiRoutes } from './routers/api.route';
import { PrismaService } from '@prisma/prisma.service';
import { OdataModule } from '@module/odata/odata.module';
import { AuthMiddleWare } from 'middleware/auth/Auth.middleware';
import { QueryBuilder } from 'middleware/odata/QueryBuilder';

@Module({
  imports: [
    NotificationModule,
    BiometricsModule,
    MachineModule,
    CalculationsModule,
    ImportModule,
    SalesForecastModule,
    EmployeeWeekendsModule,
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'storage', 'public'),
      serveRoot: '/public',
      serveStaticOptions: { index: false },
    }),

    OdataModule,
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
    consumer.apply(QueryBuilder).forRoutes('api');
    consumer.apply(AuthMiddleWare).forRoutes('odata/v8/*path', 'api/machine/*path', 'api/work-orders/*path', 'api/hrm/*path');
  }
}
