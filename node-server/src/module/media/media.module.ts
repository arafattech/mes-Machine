import { Module } from '@nestjs/common';
import { MediaController } from '@module/media/media.controller';
import { MediaService } from '@module/media/media.service';
import { PrismaService } from '@prisma/prisma.service';

@Module({
  controllers: [MediaController],
  providers: [MediaService , PrismaService],
})
export class MediaModule {}
