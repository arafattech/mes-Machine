import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';

@Injectable()
export class MediaService {
  constructor(private prisma: PrismaService) {}

  // async createMedia(data: {
  //   productId?: number;
  //   userId?: number;
  //   fileName: string;
  //   filePath: string;
  //   fileType: string;
  //   fileSize: number;
  //   altText?: string;
  //   isProfile?: boolean;
  //   isFeatured?: boolean;
  //   metadata?: Record<string, any>;
  // }) {
  //   const createData: any = {
  //     filename: data.fileName,
  //     filepath: data.filePath,
  //     filetype: data.fileType,
  //     filesize: data.fileSize,
  //     alttext: data.altText || null,
  //     isfeatured: data.isFeatured ?? false,
  //     metadata: data.metadata || undefined,
  //     isprofile: data.isProfile ?? false,
  //   };
  //   if (data.productId !== undefined) {
  //     createData.productid = data.productId;
  //   }
  //   if (data.userId !== undefined) {
  //     createData.userid = data.userId;
  //   }
  //   return this.prisma.medias.create({
  //     data: createData,
  //   });
  // }

  // async deleteMedia(id: number) {
  //   const media = await this.prisma.medias.findUnique({ where: { id } });
  //   if (!media) throw new NotFoundException('Media not found');

  //   if (!media.filepath) {
  //     throw new NotFoundException('Media file path not found');
  //   }
  //   const filePath = join(process.cwd(), media.filepath);
  //   if (existsSync(filePath)) unlinkSync(filePath);

  //   return this.prisma.medias.delete({ where: { id } });
  // }

  // async getAllMedia() {
  //   return this.prisma.medias.findMany();
  // }

  // async getMediaById(id: number) {
  //   return this.prisma.medias.findUnique({ where: { id } });
  // }
}
