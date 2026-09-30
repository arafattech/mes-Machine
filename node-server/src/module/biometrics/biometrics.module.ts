import { Module } from "@nestjs/common";
import { PrismaService } from "@prisma/prisma.service";
import { BiometricsController } from "./biometrics.controller";
import { BiometricsService } from "./biometrics.service";
import { AttendanceCheckoutQueueService } from "./queue/attendance-checkout.queue";
import { NotificationModule } from "@module/notification/notification.module";

@Module({
  imports: [NotificationModule],
  controllers: [BiometricsController],
  providers: [BiometricsService, AttendanceCheckoutQueueService, PrismaService],
})
export class BiometricsModule {}
